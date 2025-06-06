import datetime
from unittest.mock import MagicMock

from .vacation_starts import get_next_working_day, only_for_team_member


def test_get_next_working_day():
    member = MagicMock()
    member.country = "United States"

    # Define test cases
    test_cases = [
        (datetime.date(2025, 1, 31), datetime.date(2025, 2, 3)),
        (datetime.date(2025, 1, 30), datetime.date(2025, 1, 31)),
        (datetime.date(2025, 7, 3), datetime.date(2025, 7, 7)),  # July 4th is a holiday, skip to July 7th
    ]

    for date, expected in test_cases:
        assert get_next_working_day(member, date) == expected


class Member:
    def __init__(self, name, email):
        self.name = name
        self.email = email


def test_only_for_team_member():
    member = Member(name="John Doe", email="john.doe@example.com")
    team_vacations = [
        {"name": "John Doe", "email": "john.doe@example.com", "vacation": "2024-07-01"},
        {"name": "Jane Doe", "email": "jane.doe@example.com", "vacation": "2024-07-02"},
        {"name": "John Doe", "email": "john.doe@example.com", "vacation": "2024-08-01"},
    ]

    result = only_for_team_member(member, team_vacations)
    expected = [
        {"name": "John Doe", "email": "john.doe@example.com", "vacation": "2024-07-01"},
        {"name": "John Doe", "email": "john.doe@example.com", "vacation": "2024-08-01"},
    ]

    assert result == expected
