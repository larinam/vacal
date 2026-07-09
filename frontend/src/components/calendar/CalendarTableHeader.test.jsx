import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import CalendarTableHeader from './CalendarTableHeader';
import {buildDaysHeader, buildWeekSpans} from '../../utils/calendar';

const renderHeader = (displayMonth) => {
  const daysHeader = buildDaysHeader(displayMonth);
  const weekSpans = buildWeekSpans(daysHeader, displayMonth);
  const onAddTeamClick = vi.fn();
  render(
    <table>
      <CalendarTableHeader
        daysHeader={daysHeader}
        weekSpans={weekSpans}
        displayMonth={displayMonth}
        onAddTeamClick={onAddTeamClick}
      />
    </table>
  );
  return {daysHeader, weekSpans, onAddTeamClick};
};

test('renders a week header cell per week with matching colSpan', () => {
  const {weekSpans} = renderHeader(new Date(2026, 2, 1)); // March 2026
  Array.from(weekSpans).forEach(([week, span]) => {
    const th = screen.getByText(span < 2 ? String(week) : `Week ${week}`).closest('th');
    expect(th).toHaveAttribute('colspan', String(span));
  });
});

test('out-of-month days get the out-of-month class', () => {
  const displayMonth = new Date(2026, 6, 1); // July 2026 starts on a Wednesday
  const {daysHeader} = renderHeader(displayMonth);
  const spillover = daysHeader.find(({date}) => date.getMonth() !== displayMonth.getMonth());
  expect(spillover).toBeDefined();
  const headers = screen.getAllByRole('columnheader');
  const spilloverHeader = headers.find((th) => th.className.includes('out-of-month-day-number'));
  expect(spilloverHeader).toBeDefined();
});

test('add-team icon fires the callback', () => {
  const {onAddTeamClick} = renderHeader(new Date(2026, 2, 1));
  fireEvent.click(screen.getByTitle('Add team'));
  expect(onAddTeamClick).toHaveBeenCalled();
});
