import datetime

from backend.utils import get_country_holidays

# Assertions here are on dates, never on holiday names: the library resolves names
# against the ambient locale, so the same day is "Republic Day" on a dev machine with
# LANG=en_US and "Ден на Републиката" in the container, where it falls back to the
# country's default_language.


def test_north_macedonia_includes_orthodox_community_days():
    # The library files these under the "orthodox" category rather than "public",
    # so they are only present when the extra category is requested.
    mk = get_country_holidays("North Macedonia", 2026)

    dormition = datetime.date(2026, 8, 28)
    assert dormition in mk
    assert not mk.is_working_day(dormition)
    assert datetime.date(2026, 1, 19) in mk  # Epiphany
    assert datetime.date(2026, 5, 29) in mk  # Pentecost


def test_north_macedonia_keeps_public_days():
    mk = get_country_holidays("North Macedonia", 2026)

    assert datetime.date(2026, 8, 2) in mk  # Republic Day
    assert datetime.date(2026, 9, 8) in mk  # Independence Day


def test_countries_without_extra_categories_stay_on_public_only():
    us = get_country_holidays("United States", 2026)

    assert datetime.date(2026, 7, 4) in us  # Independence Day
    # "unofficial" category days such as Valentine's Day must not leak in.
    assert datetime.date(2026, 2, 14) not in us
