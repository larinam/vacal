import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import CalendarToolbar from './CalendarToolbar';

const renderToolbar = (props = {}) => {
  const handlers = {
    onFilterInputChange: vi.fn(),
    onManagerFilterChange: vi.fn(),
    onReportScopeChange: vi.fn(),
    setDisplayMonth: vi.fn(),
  };
  render(
    <CalendarToolbar
      filterInput=""
      managerFilterUid=""
      managerSelectOptions={[{uid: 'u1', label: 'Me (You)'}, {uid: 'u2', label: 'Bob'}]}
      reportScope="direct"
      displayMonth={new Date(2026, 6, 1)}
      todayYear={2026}
      todayMonth={6}
      showSaveIcon={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
};

test('autofocuses the filter input on mount and reports typing', () => {
  const handlers = renderToolbar();
  // Addressed by its accessible name, not just its placeholder.
  const input = screen.getByRole('searchbox', {name: 'Filter by team or member name'});
  expect(input).toHaveFocus();
  fireEvent.change(input, {target: {value: 'alp'}});
  expect(handlers.onFilterInputChange).toHaveBeenCalledWith('alp');
});

test('manager select has an accessible name, lists All members, and reports changes', () => {
  const handlers = renderToolbar();
  const select = screen.getByRole('combobox', {name: 'Filter by manager'});
  expect(select).toHaveDisplayValue('All members');
  fireEvent.change(select, {target: {value: 'u2'}});
  expect(handlers.onManagerFilterChange).toHaveBeenCalledWith('u2');
});

test('scope toggle appears only with an active manager filter', () => {
  renderToolbar();
  expect(screen.queryByRole('group', {name: 'Report scope'})).not.toBeInTheDocument();
});

// The toggle is hidden with visibility, not unmounted, so the filter column keeps a
// constant width. Below the viewport width at which the month control can still be
// screen-centred it rests against that column, so unmounting the toggle here would
// make the month jump sideways whenever a manager was picked. The test above only
// proves the toggle is out of the accessibility tree - it would still pass if the
// node were removed altogether, which is why this one checks the DOM directly.
test('hidden scope toggle keeps its layout slot instead of unmounting', () => {
  renderToolbar();
  const toggle = document.querySelector('.scope-toggle');
  expect(toggle).toBeInTheDocument();
  expect(toggle).toHaveClass('scope-toggle--reserved');
  // Inert while reserved, so the slot costs nothing in tab order.
  toggle.querySelectorAll('button').forEach((b) => expect(b).toBeDisabled());
});

// Every child of the header is assigned an explicit grid column. An extra one - a
// spacer, a wrapper, a stray icon - would be auto-placed instead, and once the three
// columns of row 1 are taken it lands on a second row, silently making the fixed bar
// twice as tall and pushing it over the calendar. Layout itself is unobservable here
// (jsdom does no CSS), so pin the child list instead.
test('header holds only the three explicitly placed grid children', () => {
  renderToolbar({showSaveIcon: true});
  const header = document.querySelector('.stickyHeader');
  // classList, not className: the save icon is an <svg>, whose className is an
  // SVGAnimatedString rather than a string.
  expect([...header.children].map((c) => [...c.classList].at(-1)))
    .toEqual(['filter-wrapper', 'monthSelector', 'save-icon']);
});

test('scope toggle exposes selected state via aria-pressed and switches scope', () => {
  const handlers = renderToolbar({managerFilterUid: 'u1', reportScope: 'direct'});
  const group = screen.getByRole('group', {name: 'Report scope'});
  expect(group).toBeInTheDocument();
  const direct = screen.getByRole('button', {name: 'Direct'});
  const entire = screen.getByRole('button', {name: 'All levels'});
  expect(direct).toHaveAttribute('aria-pressed', 'true');
  expect(entire).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(entire);
  expect(handlers.onReportScopeChange).toHaveBeenCalledWith('all');
});

test('aria-pressed follows the active scope', () => {
  renderToolbar({managerFilterUid: 'u1', reportScope: 'all'});
  expect(screen.getByRole('button', {name: 'All levels'})).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', {name: 'Direct'})).toHaveAttribute('aria-pressed', 'false');
});

test('save icon renders only when preferences were just saved', () => {
  const {container, rerender} = (() => {
    const utils = render(
      <CalendarToolbar
        filterInput=""
        onFilterInputChange={vi.fn()}
        managerFilterUid=""
        onManagerFilterChange={vi.fn()}
        managerSelectOptions={[]}
        reportScope="direct"
        onReportScopeChange={vi.fn()}
        displayMonth={new Date(2026, 6, 1)}
        setDisplayMonth={vi.fn()}
        todayYear={2026}
        todayMonth={6}
        showSaveIcon={true}
      />
    );
    return utils;
  })();
  expect(container.querySelector('.save-icon')).toBeInTheDocument();
});
