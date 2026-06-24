import {render, screen, fireEvent} from '@testing-library/react';
import MemberModal from './MemberModal';

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock('../hooks/mutations/useMemberMutations', () => ({
  default: () => ({
    createMemberMutation: {mutate: createMutate, isPending: false},
    updateMemberMutation: {mutate: updateMutate, isPending: false},
  }),
}));

beforeEach(() => {
  createMutate.mockClear();
  updateMutate.mockClear();
});

test('renders an editing member with null fields as empty controlled inputs without React warnings', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  // The backend returns `null` for optional fields that were never filled in.
  const editingMember = {
    uid: 'm1',
    name: 'Alice',
    country: 'United States',
    email: null,
    phone: null,
    birthday: null,
    employee_start_date: null,
    yearly_vacation_days: null,
    vac_days: null,
  };

  render(
    <MemberModal
      isOpen={true}
      onClose={() => {}}
      selectedTeamId="t1"
      updateTeamData={() => {}}
      editingMember={editingMember}
    />
  );

  // Editing data still loads...
  expect(screen.getByPlaceholderText("Enter member's name")).toHaveValue('Alice');
  // ...and nullable fields become empty strings, keeping the inputs controlled.
  expect(screen.getByPlaceholderText("Enter member's email")).toHaveValue('');
  expect(screen.getByPlaceholderText("Enter member's phone")).toHaveValue('');
  expect(screen.getByPlaceholderText('Enter birthday (MM-DD)')).toHaveValue('');

  // React must not warn about null values or controlled/uncontrolled inputs.
  const warned = errorSpy.mock.calls.some((args) => {
    const text = args.map(String).join(' ');
    return (
      text.includes('should not be null') ||
      text.includes('changing a controlled input')
    );
  });
  expect(warned).toBe(false);

  errorSpy.mockRestore();
});

const allMembers = [
  {uid: 'm1', name: 'Alice'},
  {uid: 'm2', name: 'Bob'},
  {uid: 'm3', name: 'Carol'},
];

test('Manager dropdown lists other members, excludes the edited member, and preselects the current manager', () => {
  const editingMember = {uid: 'm1', name: 'Alice', country: 'United States', manager_uid: 'm2'};

  render(
    <MemberModal
      isOpen={true}
      onClose={() => {}}
      selectedTeamId="t1"
      updateTeamData={() => {}}
      editingMember={editingMember}
      allMembers={allMembers}
    />
  );

  const managerSelect = screen.getByRole('combobox');
  // The edited member (Alice) is excluded; the others plus "None" are offered.
  const optionLabels = Array.from(managerSelect.options).map((o) => o.textContent);
  expect(optionLabels).toEqual(['None', 'Bob', 'Carol']);
  // The current manager is preselected.
  expect(managerSelect).toHaveValue('m2');
});

test('submitting a new member includes the selected manager_uid in the payload', () => {
  render(
    <MemberModal
      isOpen={true}
      onClose={() => {}}
      selectedTeamId="t1"
      updateTeamData={() => {}}
      editingMember={null}
      allMembers={allMembers}
    />
  );

  fireEvent.change(screen.getByPlaceholderText("Enter member's name"), {target: {value: 'Dave'}});
  fireEvent.change(screen.getByPlaceholderText("Enter member's country"), {target: {value: 'United States'}});
  fireEvent.change(screen.getByPlaceholderText('Enter employee start date'), {target: {value: '2024-01-01'}});
  fireEvent.change(screen.getByPlaceholderText('Enter yearly vacation days'), {target: {value: '25'}});
  fireEvent.change(screen.getByRole('combobox'), {target: {value: 'm2'}});

  fireEvent.click(screen.getByRole('button', {name: 'Add Member'}));

  expect(createMutate).toHaveBeenCalledTimes(1);
  const [variables] = createMutate.mock.calls[0];
  expect(variables.payload.manager_uid).toBe('m2');
});
