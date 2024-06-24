import logging

import holidays
import pycountry

log = logging.getLogger(__name__)


def get_country_holidays(country_name, year) -> holidays.HolidayBase:
    country_alpha_2 = pycountry.countries.get(name=country_name).alpha_2
    country_holidays_obj = {}
    try:
        country_holidays_obj = holidays.country_holidays(
            country_alpha_2, years=[year - 1, year, year + 1]
        )
    except NotImplementedError as e:  # there are no holidays for some countries, but it's fine
        log.warning(e, exc_info=e)
    return country_holidays_obj
