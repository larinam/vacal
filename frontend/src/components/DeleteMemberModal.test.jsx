import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteMemberModal from './DeleteMemberModal';

test('submits without requiring a departure initiator', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();

  render(
    <DeleteMemberModal
      isOpen={true}
      memberName="Alice"
      onClose={() => {}}
      onConfirm={onConfirm}
    />
  );

  await user.type(screen.getByLabelText('Member name'), 'Alice');
  await user.type(screen.getByLabelText('Last working day'), '2024-06-01');
  await user.click(screen.getByRole('button', {name: 'Delete member'}));

  expect(onConfirm).toHaveBeenCalledWith({
    lastWorkingDay: '2024-06-01',
    separationType: null,
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
