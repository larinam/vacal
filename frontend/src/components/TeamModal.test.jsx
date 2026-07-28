import {fireEvent, render, screen} from '@testing-library/react';
import TeamModal from './TeamModal';

const createMutate = vi.fn();
const updateMutate = vi.fn();
const toastError = vi.fn();

vi.mock('../hooks/mutations/useTeamManagementMutations', () => ({
  default: () => ({
    createTeamMutation: {mutate: createMutate, isPending: false},
    updateTeamMutation: {mutate: updateMutate, isPending: false},
  }),
}));

vi.mock('react-toastify', () => ({
  toast: {
    error: (...args) => toastError(...args),
    success: vi.fn(),
  },
}));

// Engineering > (Backend > Payments, Frontend); Sales is an unrelated root.
// Only Engineering and Sales are staffed, which keeps the leader options short.
const teams = [
  {_id: 'eng', name: 'Engineering', team_members: [
    {uid: 'u-bob', name: 'Bob'},
    {uid: 'u-ada', name: 'Ada'},
  ]},
  {_id: 'be', name: 'Backend', parent_team_id: 'eng'},
  {_id: 'pay', name: 'Payments', parent_team_id: 'be'},
  {_id: 'fe', name: 'Frontend', parent_team_id: 'eng'},
  {_id: 'sales', name: 'Sales', team_members: [{uid: 'u-cleo', name: 'Cleo'}]},
];

const renderModal = (props = {}) => render(
  <TeamModal
    isOpen={true}
    onClose={() => {}}
    editingTeam={null}
    teams={teams}
    canEditHierarchy={true}
    {...props}
  />
);

const parentSelect = () => screen.getByRole('combobox', {name: 'Parent team'});
const leaderSelect = () => screen.getByRole('combobox', {name: 'Team leader'});

beforeEach(() => {
  createMutate.mockClear();
  updateMutate.mockClear();
  toastError.mockClear();
});

test('parent select lists every team in tree order with an indented label', () => {
  renderModal();

  const options = Array.from(parentSelect().options);
  expect(options.map((o) => o.value)).toEqual(['', 'eng', 'be', 'pay', 'fe', 'sales']);
  // Non-breaking-space indentation is asserted on the raw text: testing-library's
  // accessible-name normalisation would collapse it away.
  expect(options.map((o) => o.textContent)).toEqual([
    'None',
    'Engineering',
    '  Backend',
    '    Payments',
    '  Frontend',
    'Sales',
  ]);
});

test('excludes the edited team and its descendants from the parent options', () => {
  renderModal({editingTeam: teams[1]}); // Backend, which has Payments under it

  const values = Array.from(parentSelect().options).map((o) => o.value);
  expect(values).toEqual(['', 'eng', 'fe', 'sales']);
});

test('preselects the current parent and coerces a null parent to None', () => {
  const {unmount} = renderModal({editingTeam: teams[2]}); // Payments, parent Backend
  expect(parentSelect()).toHaveValue('be');
  unmount();

  renderModal({editingTeam: {_id: 'sales', name: 'Sales', parent_team_id: null}});
  expect(parentSelect()).toHaveValue('');
});

test('creates a team with parent_team_id null when None is selected', () => {
  renderModal();

  fireEvent.change(screen.getByPlaceholderText('Enter team name'), {target: {value: 'Ops'}});
  fireEvent.click(screen.getByRole('button', {name: 'Add Team'}));

  expect(createMutate).toHaveBeenCalledTimes(1);
  expect(createMutate.mock.calls[0][0]).toEqual({
    payload: {name: 'Ops', parent_team_id: null, leader_uid: null},
  });
});

test('updates a team with the selected parent_team_id', () => {
  renderModal({editingTeam: {_id: 'sales', name: 'Sales', parent_team_id: null}});

  fireEvent.change(parentSelect(), {target: {value: 'eng'}});
  fireEvent.click(screen.getByRole('button', {name: 'Update Team'}));

  expect(updateMutate).toHaveBeenCalledTimes(1);
  expect(updateMutate.mock.calls[0][0]).toEqual({
    teamId: 'sales',
    payload: {name: 'Sales', parent_team_id: 'eng', leader_uid: null},
  });
});

test('a non-manager gets disabled selects and a payload without parent or leader', () => {
  renderModal({editingTeam: teams[1], canEditHierarchy: false});

  expect(parentSelect()).toBeDisabled();
  expect(leaderSelect()).toBeDisabled();

  fireEvent.change(screen.getByPlaceholderText('Enter team name'), {target: {value: 'Renamed'}});
  fireEvent.click(screen.getByRole('button', {name: 'Update Team'}));

  // Omitting the keys is what makes the backend preserve the stored values.
  expect(updateMutate.mock.calls[0][0]).toEqual({teamId: 'be', payload: {name: 'Renamed'}});
});

test('leader select lists every workspace member with their team', () => {
  renderModal();

  const options = Array.from(leaderSelect().options);
  expect(options.map((o) => o.value)).toEqual(['', 'u-ada', 'u-bob', 'u-cleo']);
  expect(options.map((o) => o.textContent)).toEqual([
    'None',
    'Ada (Engineering)',
    'Bob (Engineering)',
    'Cleo (Sales)',
  ]);
});

test('preselects the current leader and coerces a null leader to None', () => {
  const {unmount} = renderModal({editingTeam: {...teams[4], leader_uid: 'u-ada'}});
  // A leader from another team is the supported cross-team case.
  expect(leaderSelect()).toHaveValue('u-ada');
  unmount();

  renderModal({editingTeam: {_id: 'sales', name: 'Sales', leader_uid: null}});
  expect(leaderSelect()).toHaveValue('');
});

test('updates a team with the selected leader_uid', () => {
  renderModal({editingTeam: {_id: 'sales', name: 'Sales', parent_team_id: null}});

  fireEvent.change(leaderSelect(), {target: {value: 'u-cleo'}});
  fireEvent.click(screen.getByRole('button', {name: 'Update Team'}));

  expect(updateMutate.mock.calls[0][0]).toEqual({
    teamId: 'sales',
    payload: {name: 'Sales', parent_team_id: null, leader_uid: 'u-cleo'},
  });
});

test('keeps a stored leader who is no longer a candidate selected and re-sends them', () => {
  // Their team was archived, so buildTeamLeaderOptions no longer offers them.
  renderModal({editingTeam: {_id: 'sales', name: 'Sales', leader_uid: 'u-vanished'}});

  expect(leaderSelect()).toHaveValue('u-vanished');
  expect(Array.from(leaderSelect().options).map((o) => o.textContent))
    .toContain('Current leader (unavailable)');

  fireEvent.change(screen.getByPlaceholderText('Enter team name'), {target: {value: 'Renamed'}});
  fireEvent.click(screen.getByRole('button', {name: 'Update Team'}));

  expect(updateMutate.mock.calls[0][0].payload.leader_uid).toBe('u-vanished');
});

test('shows the backend cycle error detail as a toast', () => {
  updateMutate.mockImplementation((_variables, {onError}) => {
    onError({data: {detail: 'Parent team assignment would create a cycle'}});
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});

  renderModal({editingTeam: teams[0]});
  fireEvent.click(screen.getByRole('button', {name: 'Update Team'}));

  expect(toastError).toHaveBeenCalledWith('Parent team assignment would create a cycle');
});
