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

test('indents the row by its nesting depth', () => {
  renderRow({depth: 2});
  const row = screen.getByRole('row');
  // jsdom reports custom properties reliably only via getPropertyValue; data-depth
  // is the belt-and-braces assertion.
  expect(row).toHaveAttribute('data-depth', '2');
  expect(row.style.getPropertyValue('--team-depth')).toBe('2');
});

test('a team with sub-teams says the collapse also hides them', () => {
  renderRow({hasChildren: true});
  expect(screen.getByRole('button', {name: 'Collapse team and sub-teams'})).toBeInTheDocument();
});

test('a structural placeholder row is dimmed, keeps its chevron and exposes no actions', () => {
  const placeholder = {_id: 't1', name: 'Alpha', team_members: [], isStructuralPlaceholder: true};
  const handlers = renderRow({team: placeholder, hasChildren: true, isDropTarget: true});

  const row = screen.getByRole('row');
  expect(row).toHaveClass('team-row--structural');
  expect(screen.getByText('Alpha')).toBeInTheDocument();
  // The chevron must survive, or the subtree becomes impossible to hide.
  expect(screen.getByRole('button', {name: 'Collapse team and sub-teams'})).toBeInTheDocument();

  expect(screen.queryByRole('button', {name: 'Focus on team'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Edit team'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Delete team'})).not.toBeInTheDocument();
  expect(screen.queryByTitle('Add team member')).not.toBeInTheDocument();
  // A member count of (0) on a pruned ancestor would be a lie.
  expect(screen.queryByText('(0)')).not.toBeInTheDocument();

  fireEvent.drop(row);
  expect(handlers.onDrop).not.toHaveBeenCalled();
});

test('shows the team leader when one is resolved', () => {
  renderRow({leaderName: 'Ada'});

  const leader = screen.getByTitle('Team leader: Ada');
  expect(leader).toHaveTextContent('Ada');
});

test('labels the leader with their first name and keeps the full one in the tooltip', () => {
  // The name column has no room for a full name beside the action icons.
  renderRow({leaderName: 'Ada Manager'});

  const leader = screen.getByTitle('Team leader: Ada Manager');
  expect(leader).toHaveTextContent('Ada');
  expect(leader).not.toHaveTextContent('Manager');
});

test('shows no leader when the team has none, or the pointer is stale', () => {
  renderRow();

  expect(screen.queryByTitle(/^Team leader:/)).not.toBeInTheDocument();
});

test('a structural placeholder shows no leader', () => {
  // Placeholder rows deliberately carry no member data at all.
  const placeholder = {_id: 't1', name: 'Alpha', team_members: [], isStructuralPlaceholder: true};
  renderRow({team: placeholder, leaderName: 'Ada'});

  expect(screen.queryByTitle(/^Team leader:/)).not.toBeInTheDocument();
});
