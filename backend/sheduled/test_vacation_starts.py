import datetime
from unittest.mock import MagicMock

from .vacation_starts import get_next_working_day


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
