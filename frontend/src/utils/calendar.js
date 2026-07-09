import {eachDayOfInterval, endOfWeek, format, getISOWeek, isWeekend, startOfWeek} from 'date-fns';
import {getPreferredLocale} from './locale';

export const formatDate = (date) => {
  return format(date, 'yyyy-MM-dd');
};

export const getMemberDayEntry = (member, date) => {
  const dateStr = formatDate(date);
  return member?.days?.[dateStr] || {};
};

export const getMemberDayComment = (member, date) => {
  const entry = getMemberDayEntry(member, date);
  return entry?.comment || '';
};

// Returns the holiday name (a truthy string) rather than a boolean: callers
// store the raw value in selectedDayInfo.isHolidayDay and the day-type menu's
// override rules rely on its truthiness.
export const isHoliday = (holidayData, country, date) => {
  const dateStr = formatDate(date);
  return holidayData[country] && holidayData[country][dateStr];
};

export const getHolidayName = (holidayData, country, date) => {
  const dateStr = formatDate(date);
  return holidayData[country] && holidayData[country][dateStr] ? holidayData[country][dateStr] : '';
};

export const getCellTitle = (holidayData, member, date) => {
  const dayEntry = getMemberDayEntry(member, date);
  const dayTypes = dayEntry?.day_types || [];
  const comment = (dayEntry?.comment || '').trim();

  if (dayTypes && dayTypes.length > 0) {
    const dayTypesText = dayTypes.map(dt => dt.name).join(', '); // Join multiple day types with a comma
    return comment ? `${dayTypesText}: ${comment}` : dayTypesText;
  }

  if (comment) {
    return comment;
  }

  const holidayName = getHolidayName(holidayData, member.country, date);
  if (holidayName) {
    return holidayName;
  }

  if (isWeekend(date)) {
    return 'Weekend';
  }

  return ''; // No special title for regular days
};

export const haveSameDayTypes = (first = [], second = []) => {
  if (first.length !== second.length) {
    return false;
  }
  const sortedFirst = [...first].sort();
  const sortedSecond = [...second].sort();
  return sortedFirst.every((value, index) => value === sortedSecond[index]);
};

export const isSelectableDay = (member, date, holidayData, baseTypes = []) => {
  const dayEntry = getMemberDayEntry(member, date);
  const dayTypeIds = (dayEntry?.day_types || []).map(dt => dt._id);

  if (baseTypes.length > 0) {
    return haveSameDayTypes(baseTypes, dayTypeIds);
  }

  const hasExistingDayTypes = dayTypeIds.length > 0;

  return (
    !isWeekend(date) &&
    !isHoliday(holidayData, member.country, date) &&
    !hasExistingDayTypes
  );
};

export const generateGradientStyle = (dateDayTypes) => {
  const style = {};

  if (dateDayTypes.length > 0) {
    // Clone to avoid mutating the original array assigned to calendar state
    const typesForGradient = [...dateDayTypes];
    // Move the "Vacation" day type to the front if it exists
    const vacationIndex = typesForGradient.findIndex(dayType => dayType.name === "Vacation");
    if (vacationIndex > -1) {
      const [vacationDayType] = typesForGradient.splice(vacationIndex, 1);
      typesForGradient.unshift(vacationDayType);
    }

    const percentagePerType = 100 / typesForGradient.length;
    const gradientParts = typesForGradient.map((dayType, index) => {
      const start = percentagePerType * index;
      const end = percentagePerType * (index + 1);
      return `${dayType.color} ${start}% ${end}%`;
    });

    style.background = `linear-gradient(to right, ${gradientParts.join(', ')})`;
  }

  return style;
};

// Header cells for the displayed month: first Monday on/before the 1st through
// the last Sunday on/after the month's final day.
export const buildDaysHeader = (displayMonth) => {
  const firstDayOfMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
  const startDay = startOfWeek(firstDayOfMonth, {weekStartsOn: 1}); // 1 for Monday
  const lastDayOfMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0); // Last day of the month
  const endDay = endOfWeek(lastDayOfMonth, {weekStartsOn: 1});
  const daysInterval = eachDayOfInterval({start: startDay, end: endDay});

  const weekdayFormatter = new Intl.DateTimeFormat(getPreferredLocale(), {weekday: 'short'});

  return daysInterval.map(date => ({
    day: date.getDate(),
    week: getISOWeek(date),
    weekday: weekdayFormatter.format(date),
    date
  }));
};

export const buildWeekSpans = (daysHeader, displayMonth) => {
  let weekSpans = daysHeader.reduce((acc, curr) => {
    acc.set(curr.week, (acc.get(curr.week) || 0) + 1);
    return acc;
  }, new Map());

  // In December the trailing days can fall into ISO week 1 of the next year;
  // move that week to the end so the header reads chronologically.
  const isWeek1InDecember = daysHeader.some(day => day.week === 1 && displayMonth.getMonth() === 11);

  if (isWeek1InDecember) {
    const sortedWeeks = Array.from(weekSpans.keys()).sort((a, b) => {
      if (a === 1) return 1;  // Push week 1 to the end if it's part of the list
      if (b === 1) return -1; // Push week 1 to the end
      return a - b;
    });

    // Rebuild the weekSpans based on sorted weeks using a new Map
    const sortedWeekSpans = new Map();
    sortedWeeks.forEach(week => {
      sortedWeekSpans.set(week, weekSpans.get(week));
    });
    weekSpans = sortedWeekSpans;
  }

  return weekSpans;
};

// Restrict to members reporting under the selected manager. No-op when the
// manager filter is off. Running this before the text filter means the
// text filter only ever sees reports, so its team-name shortcut can stay.
export const filterTeamsByManager = (teams, visibleUids) => {
  if (!visibleUids) return teams;
  return teams
    .map(team => ({...team, team_members: team.team_members.filter(m => visibleUids.has(m.uid))}))
    .filter(team => team.team_members.length > 0);
};

// Restrict to teams/members matching the text filter (team name OR member name).
export const filterTeamsByText = (teams, filterInput) => {
  if (!filterInput) return teams;
  const filter = filterInput.toLowerCase();
  return teams.map(team => {
    // Team name matches → keep the team (and its members) as is.
    if (team.name.toLowerCase().includes(filter)) return team;
    const members = team.team_members.filter(m => m.name.toLowerCase().includes(filter));
    return members.length > 0 ? {...team, team_members: members} : null;
  }).filter(Boolean);
};

export const buildVacationTooltip = (member, selectedYear, currentYear = new Date().getFullYear()) => {
  const usedDays = member.vacation_used_days_by_year?.[selectedYear] || 0;
  const plannedDays = member.vacation_planned_days_by_year?.[selectedYear] || 0;
  const yearlyVacationDays = member.yearly_vacation_days;
  const availableVacationDays = member.vacation_available_days;
  const usedText = usedDays
    ? `${usedDays} vacation days used in ${selectedYear}`
    : `No vacation days used in ${selectedYear}`;
  const plannedText = plannedDays
    ? `${plannedDays} vacation days planned in ${selectedYear}`
    : `No vacation days planned in ${selectedYear}`;
  const yearlyVacationDaysText = yearlyVacationDays
    ? `${yearlyVacationDays} vacation days available per year`
    : 'No yearly vacation days defined';
  const availableVacationDaysText = (availableVacationDays || availableVacationDays === 0)
    ? `${availableVacationDays} vacation days available in ${currentYear}`
    : 'Vacation days availability unknown';
  let lines = [];
  if (selectedYear < currentYear) {
    lines.push(usedText);
  } else if (selectedYear > currentYear) {
    lines.push(plannedText);
  } else {
    lines.push(usedText, plannedText);
  }
  lines.push(yearlyVacationDaysText, availableVacationDaysText);
  return lines.join('\n');
};
