import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import TeamRow from './TeamRow';

const daysHeader = [
  {day: 9, week: 28, weekday: 'Thu', date: new Date(2026, 6, 9)},
];

const team = (members = [{uid: 'm1'}]) => ({_id: 't1', name: 'Alpha', team_members: members});

const renderRow = (props = {}) => {
  const handlers = {
    onToggleCollapse: vi.fn(),
    onFocusTeam: vi.fn(),
    onAddMember: vi.fn(),
    onOpenSubscriptionMenu: vi.fn(),
    onOpenHistory: vi.fn(),
    onEditTeam: vi.fn(),
    onCopyCalendarLink: vi.fn(),
    onDeleteTeam: vi.fn(),
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    onDrop: vi.fn(),
  };
  render(
    <table>
      <tbody>
      <TeamRow
        team={team()}
        daysHeader={daysHeader}
        isCollapsed={false}
        isFocused={false}
        isSubscribed={false}
        isDropTarget={false}
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

test('renders the team name with member count', () => {
  renderRow();
  expect(screen.getByText('Alpha')).toBeInTheDocument();
  expect(screen.getByText('(1)')).toBeInTheDocument();
});

test('collapse icon title reflects the collapsed state and calls back', () => {
  const handlers = renderRow();
  clickIcon('Collapse team');
  expect(handlers.onToggleCollapse).toHaveBeenCalledWith('t1');
});

test('collapsed row offers Expand team', () => {
  renderRow({isCollapsed: true});
  expect(screen.getByRole('button', {name: 'Expand team'})).toBeInTheDocument();
});

test('delete icon renders only when the team is empty', () => {
  renderRow();
  expect(screen.queryByRole('button', {name: 'Delete team'})).not.toBeInTheDocument();
});

test('empty team shows the delete icon and calls back', () => {
  const handlers = renderRow({team: team([])});
  clickIcon('Delete team');
  expect(handlers.onDeleteTeam).toHaveBeenCalledWith('t1');
});

test('drop target styling and drop callback', () => {
  const handlers = renderRow({isDropTarget: true});
  const row = screen.getByRole('row');
  expect(row).toHaveClass('drop-target');
  fireEvent.drop(row);
  expect(handlers.onDrop).toHaveBeenCalledWith(expect.anything(), 't1');
});

test('subscribed team shows the active bell', () => {
  renderRow({isSubscribed: true});
  const bell = screen.getByRole('button', {name: 'Manage team subscription'});
  expect(bell).toHaveClass('watch-icon-active');
});
