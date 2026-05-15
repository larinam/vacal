import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteMemberModal from './DeleteMemberModal';

test('submits without separation type', async () => {
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
    separationType: '',
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('submits when all required fields are filled', async () => {
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
  await user.click(screen.getByRole('radio', {name: 'Resignation (voluntary)'}));
  await user.click(screen.getByRole('button', {name: 'Delete member'}));

  expect(onConfirm).toHaveBeenCalledWith({
    lastWorkingDay: '2024-06-01',
    separationType: 'resignation',
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
