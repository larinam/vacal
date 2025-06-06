import datetime
import logging
import os

from ..email_service import send_email
from ..model import Team

log = logging.getLogger(__name__)

cors_origin = os.getenv("CORS_ORIGIN")  # should contain production domain of the frontend


def find_birthdays(team):
    today = datetime.date.today().strftime('%m-%d')  # Get today's date as MM-DD
    birthday_notifications = []

    # Iterate over team members and check if today is their birthday
    for member in team.team_members:
        if member.birthday == today:  # Compare MM-DD format
            birthday_notifications.append({
                'name': member.name,
                'birthday': member.birthday  # MM-DD format
            })

    return birthday_notifications


def generate_birthday_email_body(team):
    birthdays_today = find_birthdays(team)
    if not birthdays_today:
        return ""

    body = "Hello Team,\n\nHere are the birthdays today:\n\n"
    for birthday in birthdays_today:
        body += f"{birthday['name']}\n"

    body += f"\nCheck out the team calendar for more details at {cors_origin}."
    body += "\n\nBest regards,\nVacation Calendar"

    return body


def send_birthday_email_updates():
    log.debug("Start scheduled task send_birthday_email_updates")
    for team in Team.objects():
        email_body = generate_birthday_email_body(team)
        if not email_body:
            continue  # Skip if there are no birthdays today
        for subscriber in team.subscribers:
            send_email(f"Birthdays Today - {team.name} - {datetime.date.today().strftime('%B %d')}",
                       email_body, subscriber.email)
    log.debug("Stop scheduled task send_birthday_email_updates")
