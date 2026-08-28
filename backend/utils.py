import datetime
import logging
from functools import lru_cache

import holidays
import pycountry

log = logging.getLogger(__name__)

# Countries whose statutory days off are not fully covered by the library's default
# "public" category. North Macedonia files the Orthodox-community days off (Dormition,
# Epiphany, Orthodox Christmas Eve, Good Friday, Pentecost) under "orthodox" because
# by law they are non-working days for members of that community rather than for
# everyone. TeamMember has no religion field to key that off, so we mark them for the
# whole country: showing them for everyone is far less wrong than dropping them.
EXTRA_HOLIDAY_CATEGORIES = {
    "North Macedonia": ("public", "orthodox"),
}


def get_today() -> datetime.date:
    """Return today's date. Extracted for easier testing."""
    return datetime.date.today()


@lru_cache(maxsize=768)
def get_country_holidays(country_name, year) -> holidays.HolidayBase:
    country_alpha_2 = pycountry.countries.get(name=country_name).alpha_2
    country_holidays_obj = {}
    try:
        country_holidays_obj = holidays.country_holidays(
            country_alpha_2,
            years=[year - 1, year, year + 1],
            categories=EXTRA_HOLIDAY_CATEGORIES.get(country_name, ("public",)),
        )
    except NotImplementedError as e:  # there are no holidays for some countries, but it's fine
        log.warning(e, exc_info=e)
    return country_holidays_obj
