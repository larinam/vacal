import {API_URL} from './apiConfig';

let isRefreshing = false;
let refreshPromise = null;

/**
 * Refresh the access token using the refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<{access_token: string, refresh_token: string}>}
 */
export const refreshAccessToken = async (refreshToken) => {
  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/token/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({refresh_token: refreshToken}),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      return data;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Setup automatic token refresh timer
 * Access tokens expire in 15 minutes, we refresh at 14 minutes
 */
export const setupTokenRefreshTimer = (refreshToken, onTokenRefreshed, onRefreshFailed) => {
  const REFRESH_INTERVAL = 14 * 60 * 1000; // 14 minutes in milliseconds

  const refreshTimer = setInterval(async () => {
    try {
      const data = await refreshAccessToken(refreshToken);
      onTokenRefreshed(data.access_token, data.refresh_token);
    } catch (error) {
      console.error('Failed to refresh token:', error);
      onRefreshFailed();
      clearInterval(refreshTimer);
    }
  }, REFRESH_INTERVAL);

  return refreshTimer;
};
