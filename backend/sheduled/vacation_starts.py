import datetime
import logging
import os
from collections import defaultdict

from ..email_service import send_email
from ..model import DayType, Team
from ..utils import get_country_holidays

log = logging.getLogger(__name__)

cors_origin = os.getenv("CORS_ORIGIN")  # should contain production domain of the frontend


def find_vacation_periods(team, start_date) -> list:
    # Identify the vacation DayType ID for the tenant
    vacation_day_type = DayType.objects(tenant=team.tenant, identifier="vacation").first()

    vacation_starts = []

    start_date_str = str(start_date)
    day_before = start_date - datetime.timedelta(days=1)
    day_before_str = str(day_before)

    for member in team.team_members:
        if (start_date_str in member.days and vacation_day_type in member.days[start_date_str].day_types and
                not (day_before_str in member.days and vacation_day_type in member.days[day_before_str].day_types)):
            end_date = calculate_end_date(member, start_date, vacation_day_type)
            vacation_starts.append({
                'name': member.name,
                'email': member.email,
                'start': start_date,
                'end': end_date
            })

    return vacation_starts


def calculate_end_date(member, start_date, vacation_day_type):
    next_day = start_date + datetime.timedelta(days=1)
    holidays = get_country_holidays(member.country, start_date.year)
    while (str(next_day) in member.days and vacation_day_type in member.days[str(next_day)].day_types) or \
            (holidays and not holidays.is_working_day(next_day)):
        next_day += datetime.timedelta(days=1)
    return next_day - datetime.timedelta(days=1)


def get_next_working_day(member, date):
    next_day = date + datetime.timedelta(days=1)
    holidays = get_country_holidays(member.country, date.year)
    while holidays and not holidays.is_working_day(next_day):
        next_day += datetime.timedelta(days=1)
    return next_day


def generate_consolidated_email_body(team_vacations) -> str:
    if not team_vacations:
        return ""

    body = "Hi there!\n\n"

    for team_name, vacations in team_vacations:
        body += f"Team {team_name}:\n"
        for v in vacations:
            if v["start"] == v["end"]:
                body += f"- {v['name']} is on vacation on {v['start']}.\n"
            else:
                body += f"- {v['name']} is on vacation from {v['start']} to {v['end']}.\n"
        body += "\n"

    body += f"For details, visit {cors_origin}."
    body += "\n\nBest regards,\nVacation Calendar"

    return body


def send_vacation_email_updates() -> None:
    log.debug("Start scheduled task send_vacation_email_updates")
    today = datetime.date.today()

    # Dictionary to store vacation info per subscriber email
    vacation_info_by_subscriber = defaultdict(list)

    # Collect vacation info across all teams
    for team in Team.objects():
        vacations = find_vacation_periods(team, today)
        if vacations:
            for subscriber in team.subscribers:
                vacation_info_by_subscriber[subscriber.email].append((team.name, vacations))

    # Generate and send consolidated emails
    for email, team_vacations in vacation_info_by_subscriber.items():
        email_body = generate_consolidated_email_body(team_vacations)
        if email_body:
            send_email(f"Vacations Starting Today - {today.strftime('%B %d')}", email_body, email)

    log.debug("Stop scheduled task send_vacation_email_updates")


def send_upcoming_vacation_email_updates() -> None:
    log.debug("Start scheduled task send_upcoming_vacation_email_updates")
    today = datetime.date.today()

    # Dictionary to store vacation info per subscriber email
    vacation_info_by_subscriber = defaultdict(lambda: defaultdict(list))

    # Collect vacation info across all teams
    for team in Team.objects():
        for member in team.team_members:
            next_working_day = get_next_working_day(member, today)
            vacations_next_day = find_vacation_periods(team, next_working_day)
            if vacations_next_day:
                for subscriber in team.subscribers:
                    vacation_info_by_subscriber[subscriber.email][team.name].extend(vacations_next_day)

    # Generate and send consolidated emails
    for email, teams_vacations in vacation_info_by_subscriber.items():
        # Flatten the structure for email body generation
        flattened_vacations = [(team_name, vacations) for team_name, vacations in teams_vacations.items()]
        email_body = generate_consolidated_email_body(flattened_vacations)
        if email_body:
            send_email(f"Vacations Starting Soon - {today.strftime('%B %d')}", email_body, email)

    log.debug("Stop scheduled task send_upcoming_vacation_email_updates")
