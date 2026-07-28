import React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import CalendarComponent from './CalendarComponent';

// Only the hooks that reach the network or the auth context are stubbed. The tree
// maths under test - flattenTeamTree, the member-count rollup, collapse filtering -
// runs for real, which is the whole point: this pins the wiring between them, which
// no unit test can reach.
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({user: {_id: 'u1', name: 'Ada', email: 'ada@acme.com', role: 'manager'}}),
}));
vi.mock('../hooks/useHolidayData', () => ({default: () => ({holidayData: {}})}));
vi.mock('../hooks/mutations/useTeamManagementMutations', () => ({
  default: () => ({
    createTeamMutation: {mutate: vi.fn()},
    updateTeamMutation: {mutate: vi.fn()},
    deleteTeamMutation: {mutate: vi.fn()},
    moveMemberMutation: {mutate: vi.fn()},
  }),
}));
vi.mock('../hooks/mutations/useMemberMutations', () => ({
  default: () => ({
    createMemberMutation: {mutate: vi.fn()},
    updateMemberMutation: {mutate: vi.fn()},
    deleteMemberMutation: {mutate: vi.fn(), isPending: false},
  }),
}));

const members = (prefix, howMany) =>
  Array.from({length: howMany}, (_, i) => ({
    uid: `${prefix}-${i}`,
    name: `${prefix} ${i}`,
    country: 'Sweden',
    days: {},
  }));

// Core Tech groups sub-teams and has nobody of its own:
//   Core Tech (0) > Baldr (3) > Payments (1), and Core Tech > Data (2)
// so Core Tech totals 6 and Baldr totals 4.
const teams = () => [
  {_id: 'core', name: 'Core Tech', team_members: [], subscribers: []},
  {_id: 'baldr', name: 'Baldr', parent_team_id: 'core', team_members: members('baldr', 3), subscribers: []},
  {_id: 'pay', name: 'Payments', parent_team_id: 'baldr', team_members: members('pay', 1), subscribers: []},
  {_id: 'data', name: 'Data', parent_team_id: 'core', team_members: members('data', 2), subscribers: []},
];

// The history modals this renders reach useApi (useNavigate) and useInfiniteQuery,
// so both providers have to be present even though nothing here opens them.
const renderCalendar = () => render(
  <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
    <MemoryRouter>
      <CalendarComponent
        serverTeamData={teams()}
        holidays={{}}
        dayTypes={[]}
        updateTeamData={vi.fn()}
      />
    </MemoryRouter>
  </QueryClientProvider>
);

// The count lives in the same row as the team name.
const badgeFor = (teamName) => {
  const row = screen.getByText(teamName).closest('tr');
  return within(row).queryByText(/^\(\d+\)$/)?.textContent;
};

const collapse = (teamName) => {
  const row = screen.getByText(teamName).closest('tr');
  fireEvent.click(within(row).getByRole('button', {name: /^Collapse team/}));
};

beforeEach(() => {
  // View preferences persist, so a leaked collapsed/filter state would silently
  // change what the next test renders.
  localStorage.clear();
});

test('a team that only groups sub-teams reports its whole branch, not zero', () => {
  renderCalendar();
  expect(badgeFor('Core Tech')).toBe('(6)');
  expect(badgeFor('Baldr')).toBe('(4)');
  expect(badgeFor('Payments')).toBe('(1)');
  expect(badgeFor('Data')).toBe('(2)');
});

// The regression this guards: deriving the counts from the post-collapse list
// (visibleNodes) instead of teamNodes. Every other test still passes if that
// happens - only the rendered calendar shows it, as the badge collapses to (0).
test('collapsing a team does not change the count on it', () => {
  renderCalendar();
  expect(badgeFor('Core Tech')).toBe('(6)');

  collapse('Core Tech');

  expect(screen.queryByText('Baldr')).not.toBeInTheDocument();
  expect(badgeFor('Core Tech')).toBe('(6)');
});

test('collapsing an intermediate team leaves both it and its parent intact', () => {
  renderCalendar();

  collapse('Baldr');

  expect(screen.queryByText('Payments')).not.toBeInTheDocument();
  expect(badgeFor('Baldr')).toBe('(4)');
  expect(badgeFor('Core Tech')).toBe('(6)');
});

test('focusing a sub-team keeps its own rolled-up count', () => {
  renderCalendar();
  const row = screen.getByText('Baldr').closest('tr');
  fireEvent.click(within(row).getByRole('button', {name: 'Focus on team'}));

  expect(screen.queryByText('Data')).not.toBeInTheDocument();
  expect(badgeFor('Baldr')).toBe('(4)');
});

test('a filter that prunes an ancestor leaves it as context with no count', () => {
  renderCalendar();
  // A member of the deepest team, by name. Deliberately not a substring of any team
  // name, so this is a member-only match and the ancestors really do get pruned.
  fireEvent.change(screen.getByRole('searchbox', {name: /Filter by team or member name/}), {
    target: {value: 'pay 0'},
  });

  // Core Tech and Baldr survive only to keep the nesting readable.
  expect(screen.getByText('Core Tech').closest('tr')).toHaveClass('team-row--structural');
  expect(badgeFor('Core Tech')).toBeUndefined();
  expect(badgeFor('Payments')).toBe('(1)');
});
