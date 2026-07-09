import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import MemberRow from './MemberRow';

const TEAM = {_id: 't1', name: 'Alpha'};
const MEMBER = {
  uid: 'm1',
  name: 'Alice',
  country: 'Sweden',
  country_flag: '🇸🇪',
  days: {},
  yearly_vacation_days: 25,
  vacation_available_days: 10,
};

const daysHeader = [
  {day: 9, week: 28, weekday: 'Thu', date: new Date(2026, 6, 9)},
  {day: 10, week: 28, weekday: 'Fri', date: new Date(2026, 6, 10)},
];

const renderRow = (props = {}) => {
  const handlers = {
    onOpenHistory: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onEditMember: vi.fn(),
    onDeleteMember: vi.fn(),
    onDayMouseDown: vi.fn(),
    onDayMouseOver: vi.fn(),
    onDayMouseUp: vi.fn(),
    onDayClick: vi.fn(),
  };
  render(
    <table>
      <tbody>
      <MemberRow
        team={TEAM}
        member={MEMBER}
        daysHeader={daysHeader}
        holidayData={{}}
        selectedCells={[]}
        isDragging={false}
        canManageMembers={true}
        displayYear={2026}
        {...handlers}
        {...props}
      />
      </tbody>
    </table>
  );
  return handlers;
};

// Action icons here pass wrapperProps.role='button', so the accessible name
// and the onClick handler both live on the wrapping span.
const clickIcon = (name) => {
  fireEvent.click(screen.getByRole('button', {name}));
};

test('renders the member name, flag, and one day cell per header entry', () => {
  renderRow();
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('🇸🇪')).toBeInTheDocument();
  expect(screen.getAllByRole('cell')).toHaveLength(1 + daysHeader.length);
});

test('info icon title carries the vacation summary for the display year', () => {
  renderRow();
  const info = screen.getByRole('img', {name: /vacation days/i});
  expect(info).toHaveAccessibleName(/10 vacation days available/);
});

test('history and edit icons call back with the team id', () => {
  const handlers = renderRow();
  clickIcon('View history');
  expect(handlers.onOpenHistory).toHaveBeenCalledWith('t1', MEMBER);
  clickIcon('Edit member');
  expect(handlers.onEditMember).toHaveBeenCalledWith('t1', 'm1');
});

test('delete icon appears only for managers', () => {
  const handlers = renderRow();
  clickIcon('Delete member');
  expect(handlers.onDeleteMember).toHaveBeenCalledWith('t1', 'm1');
});

test('delete icon is hidden for non-managers', () => {
  renderRow({canManageMembers: false});
  expect(screen.queryByRole('button', {name: 'Delete member'})).not.toBeInTheDocument();
});

test('dragging state applies the dragging class to the row', () => {
  renderRow({isDragging: true});
  expect(screen.getByRole('row')).toHaveClass('dragging');
});
