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

    # Iterate over team members and check if the start_date is a vacation
    for member in team.team_members:
        day_before = start_date - datetime.timedelta(days=1)
        start_day_vacation = str(start_date) in member.days and vacation_day_type in member.days[str(start_date)]
        day_before_vacation = str(day_before) in member.days and vacation_day_type in member.days[str(day_before)]

        if start_day_vacation and not day_before_vacation:
            # Initialize the vacation start and end dates
            start = start_date
            end = start_date

            # Extend the end date as long as consecutive vacation days are found
            next_day = start + datetime.timedelta(days=1)
            while str(next_day) in member.days and vacation_day_type in member.days[str(next_day)]:
                end = next_day
                next_day += datetime.timedelta(days=1)

            vacation_starts.append({
                'name': member.name,
                'email': member.email,  # assuming you might need additional info
                'start': start,
                'end': end
            })

    return vacation_starts


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
    for team in Team.objects():
        email_body = generate_email_body(team)
        if not email_body:
            continue
        for email in team.subscriber_emails:
            send_email(f"Upcoming vacations starting on {datetime.date.today()}",
                       email_body, email)
    log.debug("Stop scheduled task send_vacation_email_updates")
