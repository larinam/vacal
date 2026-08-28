import datetime

import holidays
import pycountry
from holidays.countries import Sweden

from backend.routers.teams import COUNTRIES_MARKING_EVERY_SUNDAY, _is_sunday_noise
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


def test_plain_sundays_are_noise_in_every_language_sweden_ships():
    # The whole point of the structural check: it must hold no matter which language
    # the library resolves names in, since the container and a dev machine differ.
    plain_sunday = datetime.date(2026, 3, 1)
    easter_sunday = datetime.date(2026, 4, 5)
    whit_sunday = datetime.date(2026, 5, 24)

    for language in Sweden.supported_languages:
        se = holidays.country_holidays("SE", years=[2026], language=language)

        assert _is_sunday_noise(se, plain_sunday), language
        # Real holidays that happen to fall on a Sunday must survive.
        assert not _is_sunday_noise(se, easter_sunday), language
        assert not _is_sunday_noise(se, whit_sunday), language


def test_weekday_holidays_are_never_sunday_noise():
    se = holidays.country_holidays("SE", years=[2026])

    assert not _is_sunday_noise(se, datetime.date(2026, 6, 6))  # National Day, a Saturday
    assert not _is_sunday_noise(se, datetime.date(2026, 5, 1))  # May Day, a Friday


def test_sweden_is_the_only_country_needing_the_sunday_special_case():
    # Guards the frozenset: if a library update gives another country the
    # every-Sunday-is-a-holiday treatment, this test should fail and prompt a look.
    sundays = [d for d in (datetime.date(2026, 1, 1) + datetime.timedelta(days=i)
                           for i in range(365)) if d.weekday() == 6]
    offenders = set()
    for country in pycountry.countries:
        try:
            country_holidays = holidays.country_holidays(country.alpha_2, years=[2026])
        except NotImplementedError:
            continue
        if sum(1 for d in sundays if d in country_holidays) > len(sundays) * 0.9:
            offenders.add(country.name)

    assert offenders == set(COUNTRIES_MARKING_EVERY_SUNDAY)
