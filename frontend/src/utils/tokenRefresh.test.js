import {getAccessTokenExpiry, isAccessTokenStale, refreshAccessToken, startTokenRefresh} from './tokenRefresh';

const encodePayload = (payload) =>
  btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const jwtExpiringAt = (epochSeconds) => `header.${encodePayload({sub: 'alice', exp: epochSeconds})}.signature`;

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('getAccessTokenExpiry', () => {
  it('reads the exp claim from a bare token and from a Bearer header', () => {
    const exp = nowSeconds() + 900;
    expect(getAccessTokenExpiry(jwtExpiringAt(exp))).toBe(exp * 1000);
    expect(getAccessTokenExpiry(`Bearer ${jwtExpiringAt(exp)}`)).toBe(exp * 1000);
  });

  it('returns null for missing or unreadable tokens', () => {
    expect(getAccessTokenExpiry('')).toBeNull();
    expect(getAccessTokenExpiry(undefined)).toBeNull();
    expect(getAccessTokenExpiry('not-a-jwt')).toBeNull();
    expect(getAccessTokenExpiry('header.not-base64-json.signature')).toBeNull();
    expect(getAccessTokenExpiry(`header.${encodePayload({sub: 'alice'})}.signature`)).toBeNull();
  });
});

describe('isAccessTokenStale', () => {
  it('treats an expired token as stale', () => {
    expect(isAccessTokenStale(jwtExpiringAt(nowSeconds() - 1))).toBe(true);
  });

  it('treats a token inside the renewal skew as stale', () => {
    expect(isAccessTokenStale(jwtExpiringAt(nowSeconds() + 30))).toBe(true);
  });

  it('treats a token with plenty of life left as fresh', () => {
    expect(isAccessTokenStale(jwtExpiringAt(nowSeconds() + 900))).toBe(false);
  });

  it('treats an unreadable token as stale so it gets replaced', () => {
    expect(isAccessTokenStale('')).toBe(true);
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  it('shares a single request between concurrent callers', async () => {
    // The backend rotates the refresh token on every call, so a second parallel
    // request would send an already revoked token.
    let resolveFetch;
    global.fetch.mockImplementation(() => new Promise((resolve) => {
      resolveFetch = () => resolve({
        ok: true,
        status: 200,
        json: async () => ({access_token: 'new-access', refresh_token: 'new-refresh'}),
      });
    }));

    const first = refreshAccessToken('stored-refresh');
    const second = refreshAccessToken('stored-refresh');
    resolveFetch();

    await expect(first).resolves.toEqual({access_token: 'new-access', refresh_token: 'new-refresh'});
    await expect(second).resolves.toEqual({access_token: 'new-access', refresh_token: 'new-refresh'});
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports the response status so callers can tell a refusal from an outage', async () => {
    global.fetch.mockResolvedValue({ok: false, status: 401, json: async () => ({})});
    const refused = await refreshAccessToken('stored-refresh').catch((error) => error);
    expect(refused.status).toBe(401);

    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const outage = await refreshAccessToken('stored-refresh').catch((error) => error);
    expect(outage.status).toBeUndefined();
  });

  it('starts a new request once the previous one has settled', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({access_token: 'new-access', refresh_token: 'new-refresh'}),
    });

    await refreshAccessToken('stored-refresh');
    await refreshAccessToken('new-refresh');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('startTokenRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renews only when the access token is stale', () => {
    const refresh = vi.fn();
    const fresh = jwtExpiringAt(nowSeconds() + 900);
    const stop = startTokenRefresh({getAuthHeader: () => `Bearer ${fresh}`, refresh, pollIntervalMs: 1000});

    vi.advanceTimersByTime(5000);
    expect(refresh).not.toHaveBeenCalled();
    stop();
  });

  it('renews on the next tick after the token has gone stale', () => {
    const refresh = vi.fn();
    let header = `Bearer ${jwtExpiringAt(nowSeconds() + 900)}`;
    const stop = startTokenRefresh({getAuthHeader: () => header, refresh, pollIntervalMs: 1000});

    header = `Bearer ${jwtExpiringAt(nowSeconds() - 1)}`;
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    stop();
  });

  it('renews when the tab becomes visible again, because timers do not fire while asleep', () => {
    const refresh = vi.fn();
    const stop = startTokenRefresh({
      getAuthHeader: () => `Bearer ${jwtExpiringAt(nowSeconds() - 1)}`,
      refresh,
      pollIntervalMs: 60_000,
    });

    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(1);

    // Past the attempt cooldown, so this is the focus signal renewing and not the
    // same wake-up counted twice.
    vi.advanceTimersByTime(6000);
    window.dispatchEvent(new Event('focus'));
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
  });

  it('throttles attempts so an outage plus tab switching is not a request per gesture', () => {
    const refresh = vi.fn();
    const stop = startTokenRefresh({
      getAuthHeader: () => `Bearer ${jwtExpiringAt(nowSeconds() - 1)}`,
      refresh,
      pollIntervalMs: 1000,
      minAttemptIntervalMs: 5000,
    });

    window.dispatchEvent(new Event('focus'));
    expect(refresh).toHaveBeenCalledTimes(1);

    // Every one of these would otherwise fire its own failing renewal.
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(2000);
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(4000);
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stops polling and listening after teardown', () => {
    const refresh = vi.fn();
    const stop = startTokenRefresh({
      getAuthHeader: () => `Bearer ${jwtExpiringAt(nowSeconds() - 1)}`,
      refresh,
      pollIntervalMs: 1000,
    });

    stop();
    vi.advanceTimersByTime(5000);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    expect(refresh).not.toHaveBeenCalled();
  });
});
