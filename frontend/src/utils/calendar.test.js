import {
  buildDaysHeader,
  buildVacationTooltip,
  buildWeekSpans,
  filterTeamsByManager,
  filterTeamsByText,
  formatDate,
  generateGradientStyle,
  getCellTitle,
  getHolidayName,
  getMemberDayComment,
  getMemberDayEntry,
  haveSameDayTypes,
  isHoliday,
  isSelectableDay,
} from './calendar';

const HOLIDAYS = {Sweden: {'2026-06-19': 'Midsummer Eve'}};

const member = (days = {}, country = 'Sweden') => ({name: 'Alice', country, days});

describe('formatDate', () => {
  test('formats as yyyy-MM-dd', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('getMemberDayEntry / getMemberDayComment', () => {
  const m = member({'2026-07-09': {day_types: [{_id: 'v'}], comment: 'trip'}});

  test('returns the entry for an existing date', () => {
    expect(getMemberDayEntry(m, new Date(2026, 6, 9)).comment).toBe('trip');
    expect(getMemberDayComment(m, new Date(2026, 6, 9))).toBe('trip');
  });

  test('returns empty values for a missing date', () => {
    expect(getMemberDayEntry(m, new Date(2026, 6, 10))).toEqual({});
    expect(getMemberDayComment(m, new Date(2026, 6, 10))).toBe('');
  });
});

describe('isHoliday / getHolidayName', () => {
  test('returns the raw holiday name (truthy string), not a boolean', () => {
    expect(isHoliday(HOLIDAYS, 'Sweden', new Date(2026, 5, 19))).toBe('Midsummer Eve');
    expect(getHolidayName(HOLIDAYS, 'Sweden', new Date(2026, 5, 19))).toBe('Midsummer Eve');
  });

  test('is falsy / empty for unknown country or date', () => {
    expect(isHoliday(HOLIDAYS, 'Norway', new Date(2026, 5, 19))).toBeFalsy();
    expect(getHolidayName(HOLIDAYS, 'Norway', new Date(2026, 5, 19))).toBe('');
    expect(getHolidayName(HOLIDAYS, 'Sweden', new Date(2026, 5, 20))).toBe('');
  });
});

describe('getCellTitle', () => {
  test('day types with comment', () => {
    const m = member({'2026-07-09': {day_types: [{name: 'Vacation'}], comment: 'note'}});
    expect(getCellTitle({}, m, new Date(2026, 6, 9))).toBe('Vacation: note');
  });

  test('day types only, joined with commas', () => {
    const m = member({'2026-07-09': {day_types: [{name: 'Vacation'}, {name: 'Sick'}]}});
    expect(getCellTitle({}, m, new Date(2026, 6, 9))).toBe('Vacation, Sick');
  });

  test('comment only', () => {
    const m = member({'2026-07-09': {day_types: [], comment: 'just a note'}});
    expect(getCellTitle({}, m, new Date(2026, 6, 9))).toBe('just a note');
  });

  test('day types win over a holiday on the same date', () => {
    const m = member({'2026-06-19': {day_types: [{name: 'Sick'}]}});
    expect(getCellTitle(HOLIDAYS, m, new Date(2026, 5, 19))).toBe('Sick');
  });

  test('holiday name when no entry', () => {
    expect(getCellTitle(HOLIDAYS, member(), new Date(2026, 5, 19))).toBe('Midsummer Eve');
  });

  test('weekend and plain weekday', () => {
    expect(getCellTitle({}, member(), new Date(2026, 6, 11))).toBe('Weekend'); // Saturday
    expect(getCellTitle({}, member(), new Date(2026, 6, 9))).toBe(''); // Thursday
  });
});

describe('haveSameDayTypes', () => {
  test('is order-insensitive', () => {
    expect(haveSameDayTypes(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  test('fails on length mismatch', () => {
    expect(haveSameDayTypes(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('isSelectableDay', () => {
  test('weekends and holidays are not selectable', () => {
    expect(isSelectableDay(member(), new Date(2026, 6, 11), {})).toBe(false); // Saturday
    expect(isSelectableDay(member(), new Date(2026, 5, 19), HOLIDAYS)).toBeFalsy();
  });

  test('existing day types block selection when no base types given', () => {
    const m = member({'2026-07-09': {day_types: [{_id: 'v'}]}});
    expect(isSelectableDay(m, new Date(2026, 6, 9), {})).toBe(false);
  });

  test('with base types, only cells with the same type set are selectable', () => {
    const m = member({'2026-07-09': {day_types: [{_id: 'v'}, {_id: 's'}]}});
    expect(isSelectableDay(m, new Date(2026, 6, 9), {}, ['s', 'v'])).toBe(true);
    expect(isSelectableDay(m, new Date(2026, 6, 9), {}, ['v'])).toBe(false);
  });

  test('plain weekday with no entry is selectable', () => {
    expect(isSelectableDay(member(), new Date(2026, 6, 9), {})).toBe(true);
  });
});

describe('generateGradientStyle', () => {
  test('empty types produce no style', () => {
    expect(generateGradientStyle([])).toEqual({});
  });

  test('single type spans the full width', () => {
    expect(generateGradientStyle([{name: 'Sick', color: 'red'}]).background)
      .toBe('linear-gradient(to right, red 0% 100%)');
  });

  test('Vacation is moved to the front and the input is not mutated', () => {
    const types = [{name: 'Sick', color: 'red'}, {name: 'Vacation', color: 'green'}];
    expect(generateGradientStyle(types).background)
      .toBe('linear-gradient(to right, green 0% 50%, red 50% 100%)');
    expect(types.map((t) => t.name)).toEqual(['Sick', 'Vacation']);
  });
});

describe('buildDaysHeader', () => {
  test('spans full weeks from Monday to Sunday', () => {
    const header = buildDaysHeader(new Date(2026, 2, 1)); // March 2026
    expect(header.length % 7).toBe(0);
    expect(header[0].date.getDay()).toBe(1); // Monday
    expect(header[header.length - 1].date.getDay()).toBe(0); // Sunday
    expect(header[0].date <= new Date(2026, 2, 1)).toBe(true);
  });

  test('December includes next-January spillover in ISO week 1', () => {
    const header = buildDaysHeader(new Date(2025, 11, 1)); // December 2025
    const spillover = header.filter(({date}) => date.getFullYear() === 2026);
    expect(spillover.length).toBeGreaterThan(0);
    expect(spillover.every(({week}) => week === 1)).toBe(true);
  });
});

describe('buildWeekSpans', () => {
  test('reorders ISO week 1 to the end in December', () => {
    const displayMonth = new Date(2025, 11, 1);
    const header = buildDaysHeader(displayMonth);
    const spans = buildWeekSpans(header, displayMonth);
    const weeks = Array.from(spans.keys());
    expect(weeks).toEqual([49, 50, 51, 52, 1]);
    const total = Array.from(spans.values()).reduce((a, b) => a + b, 0);
    expect(total).toBe(header.length);
  });

  test('keeps natural order outside December', () => {
    const displayMonth = new Date(2026, 0, 1); // January 2026 starts in ISO week 1
    const header = buildDaysHeader(displayMonth);
    const weeks = Array.from(buildWeekSpans(header, displayMonth).keys());
    expect(weeks).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('filterTeamsByManager', () => {
  const teams = [
    {name: 'Alpha', team_members: [{uid: 'a'}, {uid: 'b'}]},
    {name: 'Beta', team_members: [{uid: 'c'}]},
  ];

  test('returns the same reference when no manager filter is active', () => {
    expect(filterTeamsByManager(teams, null)).toBe(teams);
  });

  test('drops members outside the set and teams left empty', () => {
    const result = filterTeamsByManager(teams, new Set(['a']));
    expect(result).toHaveLength(1);
    expect(result[0].team_members.map((m) => m.uid)).toEqual(['a']);
  });

  test('an empty set removes every team', () => {
    expect(filterTeamsByManager(teams, new Set())).toEqual([]);
  });
});

describe('filterTeamsByText', () => {
  const teams = [
    {name: 'Alpha', team_members: [{name: 'Alice'}, {name: 'Bob'}]},
    {name: 'Beta', team_members: [{name: 'Carol'}]},
  ];

  test('returns the same reference for an empty filter', () => {
    expect(filterTeamsByText(teams, '')).toBe(teams);
  });

  test('a team-name match keeps the full roster', () => {
    const result = filterTeamsByText(teams, 'alpha');
    expect(result).toHaveLength(1);
    expect(result[0].team_members).toHaveLength(2);
  });

  test('a member-only match keeps just the matching members', () => {
    const result = filterTeamsByText(teams, 'carol');
    expect(result).toHaveLength(1);
    expect(result[0].team_members.map((m) => m.name)).toEqual(['Carol']);
  });

  test('no match yields an empty list', () => {
    expect(filterTeamsByText(teams, 'zzz')).toEqual([]);
  });
});

describe('buildVacationTooltip', () => {
  const m = {
    vacation_used_days_by_year: {2025: 3},
    vacation_planned_days_by_year: {2027: 5},
    yearly_vacation_days: 25,
    vacation_available_days: 10,
  };

  test('past year shows only the used line', () => {
    const text = buildVacationTooltip(m, 2025, 2026);
    expect(text).toContain('3 vacation days used in 2025');
    expect(text).not.toContain('planned');
  });

  test('future year shows only the planned line', () => {
    const text = buildVacationTooltip(m, 2027, 2026);
    expect(text).toContain('5 vacation days planned in 2027');
    expect(text).not.toContain('used');
  });

  test('current year shows both lines', () => {
    const text = buildVacationTooltip(m, 2026, 2026);
    expect(text).toContain('No vacation days used in 2026');
    expect(text).toContain('No vacation days planned in 2026');
  });

  test('zero available days is reported explicitly, unknown as unknown', () => {
    expect(buildVacationTooltip({...m, vacation_available_days: 0}, 2026, 2026))
      .toContain('0 vacation days available in 2026');
    expect(buildVacationTooltip({...m, vacation_available_days: undefined}, 2026, 2026))
      .toContain('Vacation days availability unknown');
  });
});
