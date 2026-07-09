import {useEffect, useMemo, useState} from 'react';
import {buildDaysHeader, buildWeekSpans} from '../utils/calendar';

// Header days, week spans, and the set of years visible for a display month.
// daysHeader stays useState+useEffect (not useMemo): the empty first paint and
// the one-render delay before holiday queries fire are existing behavior.
const useCalendarGrid = (displayMonth) => {
  const [daysHeader, setDaysHeader] = useState([]);

  useEffect(() => {
    setDaysHeader(buildDaysHeader(displayMonth));
  }, [displayMonth]);

  const weekSpans = buildWeekSpans(daysHeader, displayMonth);

  const selectedYear = displayMonth.getFullYear();
  const displayedYears = useMemo(() => {
    const years = new Set();
    daysHeader.forEach(({date}) => years.add(date.getFullYear()));

    if (years.size === 0) {
      years.add(selectedYear);
    }

    return Array.from(years).sort();
  }, [daysHeader, selectedYear]);

  return {daysHeader, weekSpans, displayedYears};
};

export default useCalendarGrid;
