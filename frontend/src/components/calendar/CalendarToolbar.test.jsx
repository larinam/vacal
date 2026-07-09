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
  const input = screen.getByPlaceholderText('Filter by team or member name');
  expect(input).toHaveFocus();
  fireEvent.change(input, {target: {value: 'alp'}});
  expect(handlers.onFilterInputChange).toHaveBeenCalledWith('alp');
});

test('manager select lists All members plus the options and reports changes', () => {
  const handlers = renderToolbar();
  const select = screen.getByTitle('Filter by manager');
  expect(select).toHaveDisplayValue('All members');
  fireEvent.change(select, {target: {value: 'u2'}});
  expect(handlers.onManagerFilterChange).toHaveBeenCalledWith('u2');
});

test('scope toggle appears only with an active manager filter', () => {
  renderToolbar();
  expect(screen.queryByRole('group', {name: 'Report scope'})).not.toBeInTheDocument();
});

test('scope toggle switches to the entire hierarchy', () => {
  const handlers = renderToolbar({managerFilterUid: 'u1'});
  const group = screen.getByRole('group', {name: 'Report scope'});
  expect(group).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Entire hierarchy'}));
  expect(handlers.onReportScopeChange).toHaveBeenCalledWith('all');
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
