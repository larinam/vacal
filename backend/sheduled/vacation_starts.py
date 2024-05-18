import datetime
import logging
import os

from ..email_service import send_email
from ..model import DayType, Team

log = logging.getLogger(__name__)

cors_origin = os.getenv("CORS_ORIGIN")  # should contain production domain of the frontend


def find_vacation_periods(team, start_date):
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
    while str(next_day) in member.days and vacation_day_type in member.days[str(next_day)].day_types:
        next_day += datetime.timedelta(days=1)
    return next_day - datetime.timedelta(days=1)


def generate_email_body(team):
    today = datetime.date.today()
    vacations = find_vacation_periods(team, today)
    if not vacations:
        return ""
    body = "Hi there!\n\n"
    for v in vacations:
        if v["start"] == v["end"]:
            body += f"{v['name']} is on vacation on {v["start"]}.\n"
        else:
            body += f"{v["name"]} is on vacation from {v["start"]} to {v["end"]}.\n"
    body += f"\nFor details, visit {cors_origin}."
    body += "\n\nBest regards,\nVacation Calendar"
    return body


def send_vacation_email_updates():
    log.debug("Start scheduled task send_vacation_email_updates")
    today = datetime.date.today().strftime('%B %d')

    for team in Team.objects():
        email_body = generate_email_body(team)
        if not email_body:
            continue
        for email in team.subscriber_emails:
            send_email(f"Vacations Starting Today - {team.name} - {today}", email_body, email)
    log.debug("Stop scheduled task send_vacation_email_updates")
