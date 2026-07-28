import {act, render, screen, waitFor} from '@testing-library/react';
import {AuthProvider, useAuth} from './AuthContext';

const {toastMock} = vi.hoisted(() => ({
  toastMock: {success: vi.fn(), error: vi.fn(), warn: vi.fn()},
}));

vi.mock('react-toastify', () => ({
  toast: toastMock,
}));

const encodePayload = (payload) =>
  btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const jwtExpiringIn = (seconds) =>
  `header.${encodePayload({sub: 'alice', exp: Math.floor(Date.now() / 1000) + seconds})}.signature`;

const CURRENT_USER = {
  _id: 'u1',
  name: 'Alice',
  tenants: [{identifier: 'acme', name: 'Acme'}],
};

const Probe = () => {
  const {isAuthenticated, user, isRestoringSession} = useAuth();
  return (
    <div>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user?.name ?? 'none'}</span>
      <span data-testid="restoring">{String(isRestoringSession)}</span>
    </div>
  );
};

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const seedStoredSession = (accessToken) => {
  localStorage.setItem('isAuthenticated', 'true');
  localStorage.setItem('authHeader', `Bearer ${accessToken}`);
  localStorage.setItem('refreshToken', 'stored-refresh-token');
  localStorage.setItem('currentTenant', 'acme');
};

const calledUrls = () => global.fetch.mock.calls.map(([url]) => url);

describe('AuthProvider session bootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
    toastMock.error.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  it('renews an expired access token on startup instead of logging out', async () => {
    // The state after a night with the tab closed: the stored access token is
    // long gone, but the refresh token is still good for days.
    seedStoredSession(jwtExpiringIn(-3600));
    const freshAccessToken = jwtExpiringIn(900);

    global.fetch.mockImplementation(async (url, options) => {
      if (url === '/token/refresh') {
        expect(JSON.parse(options.body)).toEqual({refresh_token: 'stored-refresh-token'});
        return jsonResponse({access_token: freshAccessToken, refresh_token: 'rotated-refresh-token'});
      }
      if (url === '/users/me') {
        expect(options.headers.Authorization).toBe(`Bearer ${freshAccessToken}`);
        return jsonResponse(CURRENT_USER);
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    render(<AuthProvider><Probe/></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Alice'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(localStorage.getItem('authHeader')).toBe(`Bearer ${freshAccessToken}`);
    expect(localStorage.getItem('refreshToken')).toBe('rotated-refresh-token');
    // Nothing must revoke a refresh token that still had days left on it.
    expect(calledUrls()).not.toContain('/logout');
  });

  it('does not renew when the stored access token is still valid', async () => {
    const validAccessToken = jwtExpiringIn(900);
    seedStoredSession(validAccessToken);

    global.fetch.mockImplementation(async (url) => {
      if (url === '/users/me') {
        return jsonResponse(CURRENT_USER);
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    render(<AuthProvider><Probe/></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Alice'));
    expect(calledUrls()).toEqual(['/users/me']);
  });

  it('ends the session when the backend refuses the refresh token', async () => {
    seedStoredSession(jwtExpiringIn(-3600));

    global.fetch.mockImplementation(async (url) => {
      if (url === '/token/refresh') {
        return jsonResponse({detail: 'Invalid refresh token'}, 401);
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    render(<AuthProvider><Probe/></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('false'));
    expect(localStorage.getItem('authHeader')).toBe('');
    expect(localStorage.getItem('refreshToken')).toBe('');
    expect(localStorage.getItem('user')).toBeNull();
    expect(toastMock.error).toHaveBeenCalledWith('Session expired. Please log in again.');
    // The token is already dead, so there is nothing to revoke.
    expect(calledUrls()).not.toContain('/logout');
  });

  it('does not let a refresh that lands after logout revive the session', async () => {
    const validAccessToken = jwtExpiringIn(900);
    seedStoredSession(validAccessToken);
    let releaseRefresh;

    global.fetch.mockImplementation(async (url) => {
      if (url === '/users/me') {
        return jsonResponse(CURRENT_USER);
      }
      if (url === '/token/refresh') {
        await new Promise((resolve) => {
          releaseRefresh = resolve;
        });
        return jsonResponse({access_token: jwtExpiringIn(900), refresh_token: 'token-nobody-owns'});
      }
      if (url === '/logout') {
        return jsonResponse({message: 'Successfully logged out'});
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    let auth;
    const Capture = () => {
      auth = useAuth();
      return null;
    };
    render(<AuthProvider><Capture/></AuthProvider>);
    await waitFor(() => expect(auth.user?.name).toBe('Alice'));

    // A renewal is in flight (poll, or a request that hit a 401) when the user
    // clicks log out.
    const refreshInFlight = auth.refreshSession();
    await waitFor(() => expect(releaseRefresh).toBeTypeOf('function'));

    await act(async () => {
      await auth.handleLogout();
    });

    await act(async () => {
      releaseRefresh();
      await refreshInFlight;
    });

    expect(localStorage.getItem('refreshToken')).toBe('');
    expect(localStorage.getItem('authHeader')).toBe('');
    expect(localStorage.getItem('isAuthenticated')).toBe('false');
    // The tokens minted for the abandoned session must not be left alive.
    const revoked = global.fetch.mock.calls
      .filter(([url]) => url === '/logout')
      .map(([, options]) => JSON.parse(options.body).refresh_token);
    expect(revoked).toContain('stored-refresh-token');
    expect(revoked).toContain('token-nobody-owns');
  });

  it('clears an authenticated state that has lost its tokens', async () => {
    // State can outlive the tokens; leaving isAuthenticated set would strand the
    // UI in a session that cannot make a single successful request.
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('authHeader', '');
    localStorage.setItem('refreshToken', '');
    localStorage.setItem('user', JSON.stringify(CURRENT_USER));

    let auth;
    const Capture = () => {
      auth = useAuth();
      return null;
    };
    render(<AuthProvider><Capture/></AuthProvider>);

    await act(async () => {
      auth.handleSessionExpired();
    });

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeNull();
    // No tokens were present, so there is nothing to apologise for.
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('adopts the tokens of another tab that rotated first', async () => {
    // Both tabs woke up with a stale access token; this one lost the race and its
    // refresh token was already rotated away by the other tab.
    seedStoredSession(jwtExpiringIn(-3600));
    const otherTabAccessToken = jwtExpiringIn(900);

    global.fetch.mockImplementation(async (url) => {
      if (url === '/token/refresh') {
        return jsonResponse({detail: 'Invalid refresh token'}, 401);
      }
      if (url === '/users/me') {
        return jsonResponse(CURRENT_USER);
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    render(<AuthProvider><Probe/></AuthProvider>);
    await waitFor(() => expect(calledUrls()).toContain('/token/refresh'));

    // The winning tab writes storage synchronously. Its storage event may be
    // delayed - a throttled tab can be several hundred ms behind - so adoption has
    // to work off storage itself, which is what this omits the event to check.
    localStorage.setItem('authHeader', `Bearer ${otherTabAccessToken}`);
    localStorage.setItem('refreshToken', 'rotated-by-other-tab');

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Alice'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(localStorage.getItem('refreshToken')).toBe('rotated-by-other-tab');
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('keeps the session when the server cannot be reached to renew', async () => {
    seedStoredSession(jwtExpiringIn(-3600));

    global.fetch.mockImplementation(async (url) => {
      if (url === '/token/refresh') {
        throw new TypeError('Failed to fetch');
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    render(<AuthProvider><Probe/></AuthProvider>);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(localStorage.getItem('refreshToken')).toBe('stored-refresh-token');
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('reports a restore in progress while a stored session has no cached user', async () => {
    // Without this, a reload with stored tokens but no cached user shows the login
    // form even though the session is perfectly good.
    seedStoredSession(jwtExpiringIn(-3600));
    let releaseRefresh;
    const freshAccessToken = jwtExpiringIn(900);

    global.fetch.mockImplementation(async (url) => {
      if (url === '/token/refresh') {
        await new Promise((resolve) => {
          releaseRefresh = resolve;
        });
        return jsonResponse({access_token: freshAccessToken, refresh_token: 'rotated-refresh-token'});
      }
      if (url === '/users/me') {
        return jsonResponse(CURRENT_USER);
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    render(<AuthProvider><Probe/></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('restoring')).toHaveTextContent('true'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');

    await act(async () => {
      releaseRefresh();
    });

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Alice'));
    expect(screen.getByTestId('restoring')).toHaveTextContent('false');
  });

  it('stops reporting a restore once a refused session is torn down', async () => {
    seedStoredSession(jwtExpiringIn(-3600));

    global.fetch.mockImplementation(async (url) => {
      if (url === '/token/refresh') {
        return jsonResponse({detail: 'Invalid refresh token'}, 401);
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    render(<AuthProvider><Probe/></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('false'));
    expect(screen.getByTestId('restoring')).toHaveTextContent('false');
  });

  it('retries a restore that could not reach the backend instead of dropping to login', async () => {
    seedStoredSession(jwtExpiringIn(900));
    localStorage.removeItem('user');
    let attempts = 0;

    global.fetch.mockImplementation(async (url) => {
      if (url === '/users/me') {
        attempts += 1;
        if (attempts === 1) {
          return jsonResponse({detail: 'Bad gateway'}, 502);
        }
        return jsonResponse(CURRENT_USER);
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    render(<AuthProvider><Probe/></AuthProvider>);

    // After the failed attempt the session is intact and still restoring, so the
    // app waits instead of showing a login form it cannot submit while offline.
    await waitFor(() => expect(attempts).toBe(1));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('restoring')).toHaveTextContent('true');

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Alice'), {timeout: 4000});
    expect(screen.getByTestId('restoring')).toHaveTextContent('false');
  });

  it('revokes the refresh token on an explicit logout', async () => {
    const validAccessToken = jwtExpiringIn(900);
    seedStoredSession(validAccessToken);

    global.fetch.mockImplementation(async (url) => {
      if (url === '/users/me') {
        return jsonResponse(CURRENT_USER);
      }
      if (url === '/logout') {
        return jsonResponse({message: 'Successfully logged out'});
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    let auth;
    const Capture = () => {
      auth = useAuth();
      return null;
    };
    render(<AuthProvider><Capture/></AuthProvider>);
    await waitFor(() => expect(auth.user?.name).toBe('Alice'));

    await act(async () => {
      await auth.handleLogout();
    });

    const logoutCall = global.fetch.mock.calls.find(([url]) => url === '/logout');
    expect(JSON.parse(logoutCall[1].body)).toEqual({refresh_token: 'stored-refresh-token'});
    expect(localStorage.getItem('refreshToken')).toBe('');
  });
});
