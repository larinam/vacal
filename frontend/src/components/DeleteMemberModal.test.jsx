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

test('the date picker no longer caps at today and is bounded by the start date', () => {
  render(
    <DeleteMemberModal
      isOpen={true}
      memberName="Alice"
      employeeStartDate="2020-02-01"
      onClose={() => {}}
      onConfirm={() => {}}
    />
  );

  const input = screen.getByLabelText('Last working day');
  // The max attribute was the only thing blocking a future last working day.
  expect(input).not.toHaveAttribute('max');
  expect(input).toHaveAttribute('min', '2020-02-01');
});

test('a future last working day is accepted and reads as a scheduled departure', async () => {
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
  await user.type(screen.getByLabelText('Last working day'), '2099-03-31');

  // The submit button and the hint both flip once the date is in the future.
  expect(screen.getByText(/stays on the calendar until 2099-03-31/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', {name: 'Schedule departure'}));

  expect(onConfirm).toHaveBeenCalledWith({
    lastWorkingDay: '2099-03-31',
    separationType: '',
  });
});

test('a last working day before the start date is rejected in the handler', async () => {
  // The min attribute only constrains the picker; userEvent.type walks straight past it,
  // which is exactly why the check has to exist in handleSubmit too.
  const user = userEvent.setup();
  const onConfirm = vi.fn();

  render(
    <DeleteMemberModal
      isOpen={true}
      memberName="Alice"
      employeeStartDate="2025-05-01"
      onClose={() => {}}
      onConfirm={onConfirm}
    />
  );

  await user.type(screen.getByLabelText('Member name'), 'Alice');
  await user.type(screen.getByLabelText('Last working day'), '2025-04-30');
  await user.click(screen.getByRole('button', {name: 'Delete member'}));

  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The last working day cannot be before the start date (2025-05-01).');
});

test('a name mismatch reports it without mentioning deletion', async () => {
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

  await user.type(screen.getByLabelText('Member name'), 'Alicia');
  await user.type(screen.getByLabelText('Last working day'), '2099-03-31');
  await user.click(screen.getByRole('button', {name: 'Schedule departure'}));

  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The entered name did not match. No changes were made.');
});

test('the cancel-departure button appears only when one is already scheduled', async () => {
  const user = userEvent.setup();
  const onCancelSeparation = vi.fn();

  const {unmount} = render(
    <DeleteMemberModal
      isOpen={true}
      memberName="Alice"
      onClose={() => {}}
      onConfirm={() => {}}
      onCancelSeparation={onCancelSeparation}
    />
  );
  expect(screen.queryByRole('button', {name: 'Cancel scheduled departure'}))
    .not.toBeInTheDocument();
  unmount();

  render(
    <DeleteMemberModal
      isOpen={true}
      memberName="Alice"
      scheduledLastWorkingDay="2099-03-31"
      onClose={() => {}}
      onConfirm={() => {}}
      onCancelSeparation={onCancelSeparation}
    />
  );

  // The already-scheduled date seeds the field, so the manager can edit it in place.
  expect(screen.getByLabelText('Last working day')).toHaveValue('2099-03-31');
  await user.click(screen.getByRole('button', {name: 'Cancel scheduled departure'}));
  expect(onCancelSeparation).toHaveBeenCalled();
});

test('a missing last working day is still rejected without native validation', async () => {
  // The form is noValidate, so the required attribute no longer blocks submission and
  // this check has to come from the handler.
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
  await user.click(screen.getByRole('button', {name: 'Delete member'}));

  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Please provide the last working day.');
});
