import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import UserManagement from './UserManagement';

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

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({user: CURRENT_USER}),
}));

vi.mock('../../contexts/ConfigContext', () => ({
  useConfig: () => ({
    googleClientId: 'google-client-id',
    isTelegramEnabled: true,
    telegramBotUsername: 'vacal_bot',
  }),
}));

vi.mock('../../hooks/useGoogleAuth', () => ({
  default: (onConnect) => () => onConnect({id_token: 'google-id-token'}),
}));

vi.mock('../auth/TelegramLogin', () => ({
  default: ({onAuth}) => (
    <button onClick={() => onAuth({id: 42, username: 'alice_tg'})}>tg-auth</button>
  ),
}));

const baseUser = {
  _id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  username: 'alice',
  auth_details: {},
};
let CURRENT_USER = baseUser;

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/main/settings/users']}>
        <UserManagement/>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  CURRENT_USER = baseUser;
  apiCallMock.mockImplementation((url) => {
    if (url === '/users') {
      return Promise.resolve([CURRENT_USER]);
    }
    if (url === '/users/invites') {
      return Promise.resolve([]);
    }
    return Promise.resolve({});
  });
});

const clickIcon = async (user, name) => {
  // FontAwesomeIconWithTitle places the onClick handler on the inner <svg>,
  // while the accessible name lives on the wrapping <span role="img">.
  const wrapper = screen.getByRole('img', {name});
  await user.click(wrapper.querySelector('svg') ?? wrapper);
};

test('connects a Google account from the connect icon', async () => {
  const user = userEvent.setup();
  renderComponent();

  await screen.findByText('alice@example.com');
  expect(screen.getByRole('img', {name: 'Connect Telegram account'})).toBeInTheDocument();

  await clickIcon(user, 'Connect Google account');

  await waitFor(() =>
    expect(apiCallMock).toHaveBeenCalledWith('/google-connect', 'POST', {token: 'google-id-token'})
  );
  expect(toastMock.success).toHaveBeenCalledWith('Google account connected');
});

test('shows disconnect icons for linked accounts and fires the DELETE calls', async () => {
  CURRENT_USER = {
    ...baseUser,
    auth_details: {google_id: 'g1', google_email: 'alice@gmail.com', telegram_id: 42},
  };
  const user = userEvent.setup();
  renderComponent();

  await screen.findByText('alice@example.com');
  expect(screen.queryByRole('img', {name: 'Connect Google account'})).not.toBeInTheDocument();

  await clickIcon(user, 'Disconnect Google account');
  await waitFor(() =>
    expect(apiCallMock).toHaveBeenCalledWith('/google-connect', 'DELETE')
  );

  await clickIcon(user, 'Disconnect Telegram account');
  await waitFor(() =>
    expect(apiCallMock).toHaveBeenCalledWith('/telegram-connect', 'DELETE')
  );
});

test('connects Telegram through the modal and closes it on success', async () => {
  const user = userEvent.setup();
  renderComponent();

  await screen.findByText('alice@example.com');
  expect(screen.queryByText('tg-auth')).not.toBeInTheDocument();

  await clickIcon(user, 'Connect Telegram account');
  await user.click(await screen.findByText('tg-auth'));

  await waitFor(() =>
    expect(apiCallMock).toHaveBeenCalledWith('/telegram-connect', 'POST', {id: 42, username: 'alice_tg'})
  );
  expect(toastMock.success).toHaveBeenCalledWith('Telegram account connected');
  await waitFor(() => expect(screen.queryByText('tg-auth')).not.toBeInTheDocument());
});

test('resets MFA after confirmation', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const user = userEvent.setup();
  renderComponent();

  await screen.findByText('alice@example.com');
  await clickIcon(user, 'Reset MFA for Alice');

  await waitFor(() =>
    expect(apiCallMock).toHaveBeenCalledWith('/users/u1/reset-mfa', 'POST')
  );
  expect(toastMock.success).toHaveBeenCalledWith('MFA reset successfully');
});
