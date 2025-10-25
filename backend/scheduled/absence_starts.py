import datetime
import logging
import os
from collections import defaultdict

from ..email_service import send_email
from ..model import DayType, Team
from ..notification_types import (
    ABSENCE_DAILY_NOTIFICATION,
    ABSENCE_UPCOMING_NOTIFICATION,
)
from ..utils import get_country_holidays

log = logging.getLogger(__name__)

cors_origin = os.getenv("CORS_ORIGIN")  # should contain production domain of the frontend


def find_absence_periods(team, start_date) -> list:
    absence_day_types = list(DayType.objects(tenant=team.tenant, is_absence=True))

    absence_starts = []

    start_date_str = str(start_date)
    day_before = start_date - datetime.timedelta(days=1)
    day_before_str = str(day_before)

    for member in team.members():
        if (is_absent(member, start_date_str, absence_day_types) and
                not (is_absent(member, day_before_str, absence_day_types))):
            end_date = calculate_end_date(member, start_date, absence_day_types)
            absence_starts.append({
                'name': member.name,
                'email': member.email,
                'start': start_date,
                'end': end_date
            })

    return absence_starts


def is_absent(member, date_str, absence_day_types):
    return date_str in member.days and any(dt in member.days[date_str].day_types for dt in absence_day_types)


def calculate_end_date(member, start_date, absence_day_types):
    next_day = start_date + datetime.timedelta(days=1)
    holidays = get_country_holidays(member.country, start_date.year)
    while (str(next_day) in member.days and
           any(dt in member.days[str(next_day)].day_types for dt in absence_day_types)) or \
            (holidays and not holidays.is_working_day(next_day)):
        next_day += datetime.timedelta(days=1)
    return next_day - datetime.timedelta(days=1)


def get_next_working_day(member, date):
    next_day = date + datetime.timedelta(days=1)
    holidays = get_country_holidays(member.country, date.year)
    while holidays and not holidays.is_working_day(next_day):
        next_day += datetime.timedelta(days=1)
    return next_day


def is_working_day(member, date):
    holidays = get_country_holidays(member.country, date.year)
    return holidays.is_working_day(date)


def generate_consolidated_email_body(team_absences) -> str:
    if not team_absences:
        return ""

    body = "Hi there!\n\n"

    for team_name, absences in team_absences:
        body += f"{team_name}:\n"
        for v in absences:
            if v["start"] == v["end"]:
                body += f"- {v['name']} is absent on {v['start']}.\n"
            else:
                body += f"- {v['name']} is absent from {v['start']} to {v['end']}.\n"
        body += "\n"

    body += f"For details, visit {cors_origin}."
    body += "\n\nBest regards,\nVacation Calendar"

    return body


def send_absence_email_updates() -> None:
    log.debug("Start scheduled task send_absence_email_updates")
    today = datetime.date.today()

    absence_info_by_subscriber = defaultdict(list)

    for team in Team.objects():
        absences = find_absence_periods(team, today)
        if absences:
            for email in team.get_subscriber_emails(ABSENCE_DAILY_NOTIFICATION):
                absence_info_by_subscriber[email].append((team.name, absences))

    for email, team_absences in absence_info_by_subscriber.items():
        email_body = generate_consolidated_email_body(team_absences)
        if email_body:
            send_email(f"Absences Starting Today - {today.strftime('%B %d')}", email_body, email)

    log.debug("Stop scheduled task send_absence_email_updates")


def only_for_team_member(member, team_absences) -> list:
    return list(filter(lambda absence: absence['name'] == member.name and absence['email'] == member.email,
                       team_absences))


def send_upcoming_absence_email_updates() -> None:
    log.debug("Start scheduled task send_upcoming_absence_email_updates")
    today = datetime.date.today()

    absence_info_by_subscriber = defaultdict(lambda: defaultdict(list))

    for team in Team.objects():
        absence_day_types = list(DayType.objects(tenant=team.tenant, is_absence=True))
        for member in team.members():
            if not is_working_day(member, today) or is_absent(member, str(today), absence_day_types):
                continue  # skip sending notifications on weekends, holidays and if it is already absence for the team member
            next_working_day = get_next_working_day(member, today)
            absences_next_day = find_absence_periods(team, next_working_day)
            if absences_next_day:
                filtered_absences = only_for_team_member(member, absences_next_day)
                if filtered_absences:
                    for email in team.get_subscriber_emails(ABSENCE_UPCOMING_NOTIFICATION):
                        absence_info_by_subscriber[email][team.name].extend(filtered_absences)

    for email, teams_absences in absence_info_by_subscriber.items():
        flattened_absences = [(team_name, absences) for team_name, absences in teams_absences.items()]
        email_body = generate_consolidated_email_body(flattened_absences)
        if email_body:
            send_email(f"Absences Starting Soon - {today.strftime('%B %d')}", email_body, email)

    log.debug("Stop scheduled task send_upcoming_absence_email_updates")
