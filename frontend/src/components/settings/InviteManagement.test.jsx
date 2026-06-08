import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import InviteManagement from './InviteManagement';

const {apiCallMock, toastMock} = vi.hoisted(() => ({
  apiCallMock: vi.fn(),
  toastMock: {success: vi.fn(), error: vi.fn(), warn: vi.fn()},
}));

vi.mock('../../hooks/useApi', () => ({
  useApi: () => ({apiCall: apiCallMock}),
}));

vi.mock('react-toastify', () => ({
  toast: toastMock,
}));

const INVITE = {
  _id: 'invite-1',
  email: 'frida.hedberg@paymentiq.com',
  status: 'pending',
  expiration_date: '2026-05-05T00:00:00Z',
};

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <InviteManagement/>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

const clickIcon = async (user, name) => {
  // FontAwesomeIconWithTitle places the onClick handler on the inner <svg>,
  // while the accessible name lives on the wrapping <span role="img">.
  const wrapper = screen.getByRole('img', {name});
  await user.click(wrapper.querySelector('svg') ?? wrapper);
};

test('resends an invite and shows a success toast', async () => {
  const user = userEvent.setup();
  apiCallMock.mockImplementation((url) => {
    if (url === '/users/invites') {
      return Promise.resolve([INVITE]);
    }
    return Promise.resolve({message: 'Invitation resent successfully'});
  });

  renderComponent();

  await screen.findByText(INVITE.email);

  await clickIcon(user, 'Resend invite');

  await waitFor(() =>
    expect(apiCallMock).toHaveBeenCalledWith('/users/invite/invite-1/resend', 'POST')
  );
  expect(toastMock.success).toHaveBeenCalledWith('Invitation resent successfully');
});

test('shows an error toast when resending fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const user = userEvent.setup();
  apiCallMock.mockImplementation((url) => {
    if (url === '/users/invites') {
      return Promise.resolve([INVITE]);
    }
    const error = new Error('HTTP error! Status: 404');
    error.data = {detail: 'Invite not found'};
    return Promise.reject(error);
  });

  renderComponent();

  await screen.findByText(INVITE.email);

  await clickIcon(user, 'Resend invite');

  await waitFor(() =>
    expect(toastMock.error).toHaveBeenCalledWith('Failed to resend invitation: Invite not found')
  );
});
