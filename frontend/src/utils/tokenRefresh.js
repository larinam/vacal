import {API_URL} from './apiConfig';

// Renew shortly before the access token actually expires so a request that is
// already on the wire is not rejected, and poll often enough that a throttled
// background tab - or a laptop that was suspended - recovers on its first tick
// after waking up.
const EXPIRY_SKEW_MS = 60 * 1000;
const POLL_INTERVAL_MS = 60 * 1000;
// Floor between renewal attempts. Focus and visibility both trigger a check, so
// during an outage - when every attempt fails and the token stays stale - this is
// what stops tab switching from turning into a request per gesture.
const MIN_ATTEMPT_INTERVAL_MS = 5 * 1000;

let refreshPromise = null;

/**
 * Strip the `Bearer ` prefix from an Authorization header value.
 * @param {string} value
 * @returns {string} the bare token.
 */
export const stripBearer = (value) => String(value || '').replace(/^Bearer\s+/i, '');

const decodeBase64Url = (value) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (base64.length % 4)) % 4;
  return atob(base64 + '='.repeat(padding));
};

/**
 * Read the `exp` claim out of a JWT or an `Authorization: Bearer <jwt>` value.
 * @param {string} token
 * @returns {number|null} expiry in milliseconds since the epoch, or null when
 *   the token is missing or cannot be read.
 */
export const getAccessTokenExpiry = (token) => {
  const payload = stripBearer(token).split('.')[1];
  if (!payload) {
    return null;
  }

  try {
    const {exp} = JSON.parse(decodeBase64Url(payload));
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
};

/**
 * True when the access token is missing, unreadable, or so close to expiry that
 * the next request would come back 401.
 * @param {string} token
 * @param {number} [skewMs]
 */
export const isAccessTokenStale = (token, skewMs = EXPIRY_SKEW_MS) => {
  const expiry = getAccessTokenExpiry(token);
  return expiry === null || Date.now() >= expiry - skewMs;
};

const requestRefresh = async (refreshToken) => {
  const response = await fetch(`${API_URL}/token/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({refresh_token: refreshToken}),
  });

  if (!response.ok) {
    const error = new Error('Failed to refresh token');
    error.status = response.status;
    throw error;
  }

  return response.json();
};

/**
 * Refresh the access token using the refresh token.
 *
 * Concurrent callers share a single request: the backend rotates the refresh
 * token on every call, so a second parallel call would send an already revoked
 * token and end the session.
 *
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<{access_token: string, refresh_token: string}>} rejects with
 *   an error carrying `status` when the server answered, and without one when
 *   the server could not be reached.
 */
export const refreshAccessToken = (refreshToken) => {
  if (refreshPromise) {
    return refreshPromise;
  }

  const pending = requestRefresh(refreshToken).finally(() => {
    if (refreshPromise === pending) {
      refreshPromise = null;
    }
  });
  refreshPromise = pending;
  return pending;
};

/**
 * Keep the access token fresh for as long as the app is open.
 *
 * Polls instead of sleeping for a whole token lifetime, and decides from the
 * token's own `exp` claim rather than a hardcoded lifetime. Timers do not fire
 * while the device is asleep, so the visibility and focus checks are what keep a
 * session alive across a night or a discarded tab.
 *
 * @param {object} params
 * @param {() => string} params.getAuthHeader - reads the current Authorization header.
 * @param {() => Promise<void>} params.refresh - renews the session.
 * @param {number} [params.pollIntervalMs]
 * @returns {() => void} teardown function.
 */
export const startTokenRefresh = ({
  getAuthHeader,
  refresh,
  pollIntervalMs = POLL_INTERVAL_MS,
  minAttemptIntervalMs = MIN_ATTEMPT_INTERVAL_MS,
}) => {
  let stopped = false;
  let lastAttemptAt = 0;

  const refreshIfStale = () => {
    if (stopped || !isAccessTokenStale(getAuthHeader())) {
      return;
    }
    if (Date.now() - lastAttemptAt < minAttemptIntervalMs) {
      return;
    }
    lastAttemptAt = Date.now();
    refresh();
  };

  const refreshIfVisible = () => {
    if (document.visibilityState === 'visible') {
      refreshIfStale();
    }
  };

  const timer = setInterval(refreshIfStale, pollIntervalMs);
  document.addEventListener('visibilitychange', refreshIfVisible);
  window.addEventListener('focus', refreshIfStale);

  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', refreshIfVisible);
    window.removeEventListener('focus', refreshIfStale);
  };
};
