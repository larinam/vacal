import {render, screen} from '@testing-library/react';
import MemberModal from './MemberModal';

vi.mock('../hooks/mutations/useMemberMutations', () => ({
  default: () => ({
    createMemberMutation: {mutate: vi.fn(), isPending: false},
    updateMemberMutation: {mutate: vi.fn(), isPending: false},
  }),
}));

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
