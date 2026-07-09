import {useEffect, useMemo, useState} from 'react';
import {useQueries} from '@tanstack/react-query';
import {useApi} from './useApi';
import {holidaysQueryOptions} from './queries/useHolidaysQuery';

// Holiday names per country/date ({country: {'yyyy-MM-dd': name}}), lazily
// fetched per displayed year for every country present in the teams.
const useHolidayData = ({holidays, teamCountries, displayedYears}) => {
  const {apiCall} = useApi();
  const [holidayData, setHolidayData] = useState(holidays || {});

  useEffect(() => {
    setHolidayData(holidays || {});
  }, [holidays]);

  const loadedHolidayYears = useMemo(() => {
    const years = new Set();
    Object.values(holidayData || {}).forEach(countryHolidays => {
      Object.keys(countryHolidays || {}).forEach(dateStr => {
        const [year] = dateStr.split('-');
        const parsedYear = Number(year);
        if (!Number.isNaN(parsedYear)) {
          years.add(parsedYear);
        }
      });
    });
    return years;
  }, [holidayData]);

  const yearsNeedingHolidays = useMemo(() => {
    return displayedYears.filter((year) => {
      if (!loadedHolidayYears.has(year)) {
        return true;
      }

      return teamCountries.some((country) => {
        const countryHolidays = holidayData?.[country];
        if (!countryHolidays) {
          return true;
        }
        const prefix = `${year}-`;
        return !Object.keys(countryHolidays).some((dateStr) => dateStr.startsWith(prefix));
      });
    });
  }, [displayedYears, holidayData, loadedHolidayYears, teamCountries]);

  const holidayQueries = useQueries({
    queries: yearsNeedingHolidays.map((year) => holidaysQueryOptions(apiCall, year)),
  });

  // useQueries returns a new array every render, so this effect runs each
  // render; the changed-check bail-out below keeps state updates minimal.
  useEffect(() => {
    const responses = holidayQueries
      .map((query) => query.data)
      .filter((response) => response?.holidays);

    if (responses.length === 0) {
      return;
    }

    setHolidayData((prevHolidays) => {
      let nextHolidays = prevHolidays;
      let changed = false;

      responses.forEach((current) => {
        Object.entries(current.holidays).forEach(([country, countryHolidays]) => {
          const existingCountry = (nextHolidays === prevHolidays
            ? prevHolidays[country]
            : nextHolidays[country]) || {};
          let updatedCountry = existingCountry;
          let countryChanged = false;

          Object.entries(countryHolidays || {}).forEach(([dateStr, holidayName]) => {
            if (existingCountry[dateStr] !== holidayName) {
              if (updatedCountry === existingCountry) {
                updatedCountry = {...existingCountry};
              }
              updatedCountry[dateStr] = holidayName;
              countryChanged = true;
            }
          });

          if (countryChanged) {
            if (nextHolidays === prevHolidays) {
              nextHolidays = {...prevHolidays};
            }
            nextHolidays[country] = updatedCountry;
            changed = true;
          }
        });
      });

      return changed ? nextHolidays : prevHolidays;
    });
  }, [holidayQueries]);

  useEffect(() => {
    holidayQueries.forEach((query, index) => {
      if (query.error) {
        console.error('Failed to fetch holidays for year', yearsNeedingHolidays[index], query.error);
      }
    });
  }, [holidayQueries, yearsNeedingHolidays]);

  return {holidayData};
};

export default useHolidayData;
