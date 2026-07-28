import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {toast} from 'react-toastify';
import {extractGoogleIdToken} from '../utils/google';
import {useLocalStorage} from '../hooks/useLocalStorage';
import {API_URL} from '../utils/apiConfig';
import {isAccessTokenStale, refreshAccessToken, startTokenRefresh, stripBearer} from '../utils/tokenRefresh';

export const AuthContext = createContext();

const ACCESS_TOKEN_KEY = 'authHeader';
const REFRESH_TOKEN_KEY = 'refreshToken';

// How long to wait for another tab's rotation to reach us before deciding that a
// refused refresh really is the end of the session.
const ROTATION_GRACE_MS = 500;
// A restore that could not reach the backend says nothing about the session, so
// retry a few times before falling back to the login screen.
const RESTORE_RETRY_MS = 2000;
const RESTORE_ATTEMPTS = 3;

const RESTORED = 'restored';
const SESSION_OVER = 'session-over';
const UNAVAILABLE = 'unavailable';

// Read tokens straight out of storage. Another tab writes them synchronously,
// while its storage event only reaches our React state a commit later - so during
// a rotation race this sees the winning tokens and the state does not yet.
const readStoredToken = (key) => {
    try {
        return localStorage.getItem(key) || '';
    } catch {
        return '';
    }
};

const waitUntil = (predicate, timeoutMs, intervalMs = 50) => new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
        if (predicate()) {
            resolve(true);
        } else if (Date.now() >= deadline) {
            resolve(false);
        } else {
            setTimeout(check, intervalMs);
        }
    };
    check();
});

export const AuthProvider = ({children}) => {
    const [isAuthenticated, setIsAuthenticated] = useLocalStorage('isAuthenticated', false);
    const [authHeader, setAuthHeader] = useLocalStorage(ACCESS_TOKEN_KEY, '');
    const [refreshToken, setRefreshToken] = useLocalStorage(REFRESH_TOKEN_KEY, '');
    const [currentTenant, setCurrentTenant] = useLocalStorage('currentTenant', '');
    const [user, setUser] = useLocalStorage('user', null);
    // Whether the first attempt to restore a stored session has finished. Until it
    // has, a missing user means "still loading", not "logged out".
    const [sessionChecked, setSessionChecked] = useState(false);

    // Timers and in-flight requests read the tokens through refs, so they always
    // see the latest rotation instead of the value captured when they started.
    const authHeaderRef = useRef(authHeader);
    const refreshTokenRef = useRef(refreshToken);
    // Bumped on every teardown. A refresh that resolves after the session ended
    // must not write its tokens back and quietly resurrect it.
    const sessionGenerationRef = useRef(0);

    useEffect(() => {
        authHeaderRef.current = authHeader;
        refreshTokenRef.current = refreshToken;
    }, [authHeader, refreshToken]);

    const revokeRefreshToken = useCallback(async (rawToken, header) => {
        if (!rawToken) {
            return;
        }
        try {
            await fetch(`${API_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': header || '',
                },
                body: JSON.stringify({refresh_token: rawToken})
            });
        } catch (error) {
            console.error('Failed to revoke the refresh token:', error);
        }
    }, []);

    const applyTokens = useCallback((accessToken, newRefreshToken) => {
        const header = accessToken ? `Bearer ${accessToken}` : '';
        authHeaderRef.current = header;
        refreshTokenRef.current = newRefreshToken || '';
        setAuthHeader(header);
        setRefreshToken(newRefreshToken || '');
        return header;
    }, [setAuthHeader, setRefreshToken]);

    const clearSession = useCallback(() => {
        sessionGenerationRef.current += 1;
        authHeaderRef.current = '';
        refreshTokenRef.current = '';
        setIsAuthenticated(false);
        setAuthHeader('');
        setRefreshToken('');
        setUser(null);
    }, [setIsAuthenticated, setAuthHeader, setRefreshToken, setUser]);

    /**
     * Drop the session locally, for when the backend has told us the refresh
     * token is gone: there is nothing left to revoke.
     */
    const handleSessionExpired = useCallback(() => {
        // Tear down unconditionally: state can outlive the tokens, and leaving
        // `isAuthenticated` set would strand the UI in a session that cannot work.
        const hadTokens = Boolean(authHeaderRef.current || refreshTokenRef.current);
        clearSession();
        if (hadTokens) {
            // Requests that failed in parallel land here too; only the first of
            // them still saw tokens, so the message is shown once.
            toast.error('Session expired. Please log in again.');
        }
    }, [clearSession]);

    /**
     * Exchange the stored refresh token for a fresh token pair.
     *
     * @param {boolean} [retryAfterRotation] - internal, guards the single retry.
     * @returns {Promise<{header: string|null, rejected: boolean}>} `header` is the
     *   new Authorization header. On failure, `rejected` separates a refusal by
     *   the backend - the session really is over - from not reaching the backend
     *   at all, which is worth retrying with the tokens we still hold.
     */
    const refreshSession = useCallback(async ({retryAfterRotation = true, token} = {}) => {
        const usedToken = token || refreshTokenRef.current;
        if (!usedToken) {
            return {header: null, rejected: true};
        }

        const generation = sessionGenerationRef.current;

        try {
            const data = await refreshAccessToken(usedToken);

            if (sessionGenerationRef.current !== generation) {
                // Logged out while this was in flight. These tokens belong to a
                // session nobody is in, so kill them instead of restoring it.
                revokeRefreshToken(data.refresh_token, `Bearer ${data.access_token}`);
                return {header: null, rejected: false};
            }

            return {header: applyTokens(data.access_token, data.refresh_token), rejected: false};
        } catch (error) {
            // Rotation invalidates the previous refresh token, so a token another
            // tab renewed a moment earlier is refused here. That tab has already
            // written the successor to storage, and this tab can adopt it instead
            // of logging everybody out.
            if (retryAfterRotation) {
                const rotatedElsewhere = await waitUntil(() => {
                    const stored = readStoredToken(REFRESH_TOKEN_KEY);
                    return Boolean(stored) && stored !== usedToken;
                }, ROTATION_GRACE_MS);

                if (rotatedElsewhere && sessionGenerationRef.current === generation) {
                    const storedRefresh = readStoredToken(REFRESH_TOKEN_KEY);
                    const storedHeader = readStoredToken(ACCESS_TOKEN_KEY);
                    if (!isAccessTokenStale(storedHeader)) {
                        return {
                            header: applyTokens(stripBearer(storedHeader), storedRefresh),
                            rejected: false,
                        };
                    }
                    return refreshSession({retryAfterRotation: false, token: storedRefresh});
                }
            }

            console.error('Failed to refresh the session:', error);
            return {header: null, rejected: error.status >= 400 && error.status < 500};
        }
    }, [applyTokens, revokeRefreshToken]);

    const requestCurrentUser = async (header) => {
        try {
            return await fetch(`${API_URL}/users/me`, {
                headers: {
                    'Authorization': header
                }
            });
        } catch (error) {
            console.error('Could not reach the server to load the current user:', error);
            return null;
        }
    };

    // A renewal the backend refused ends the session. One that never reached the
    // backend leaves it alone, so a flaky network does not force a new login.
    const failedRenewal = (rejected) => {
        if (rejected) {
            handleSessionExpired();
            return SESSION_OVER;
        }
        console.error('Could not renew the session, keeping the current one');
        return UNAVAILABLE;
    };

    /**
     * Load the signed-in user, renewing the access token as needed.
     * @param {string} [token] - Authorization header to start from, for a fresh login.
     * @returns {Promise<'restored'|'session-over'|'unavailable'>}
     */
    const fetchCurrentUser = async (token) => {
        // Use the token if provided, otherwise fall back to the stored one.
        let header = token || authHeaderRef.current;

        // Access tokens live minutes, so the stored one is normally expired by
        // the time the app is opened again. Renew it up front instead of
        // spending a guaranteed 401 on the first request of the session.
        if (isAccessTokenStale(header) && refreshTokenRef.current) {
            const renewal = await refreshSession();
            if (!renewal.header) {
                return failedRenewal(renewal.rejected);
            }
            header = renewal.header;
        }

        let response = await requestCurrentUser(header);

        if (response?.status === 401) {
            const renewal = await refreshSession();
            if (!renewal.header) {
                return failedRenewal(renewal.rejected);
            }
            response = await requestCurrentUser(renewal.header);
        }

        if (response?.status === 401) {
            handleSessionExpired();
            return SESSION_OVER;
        }

        if (!response?.ok) {
            // A server error or a dropped connection is not an authentication
            // failure: keep the session and let the next attempt succeed.
            console.error('Failed to fetch user data');
            return UNAVAILABLE;
        }

        const userData = await response.json();
        setUser(userData);

        const tenantIdentifiers = userData.tenants.map(t => t.identifier);
        if (!currentTenant || !tenantIdentifiers.includes(currentTenant)) {
            setCurrentTenant(userData.tenants[0].identifier);
        }
        return RESTORED;
    };

    useEffect(() => {
        if (!authHeader && !refreshToken) {
            setSessionChecked(true);
            return undefined;
        }

        let cancelled = false;
        let retryTimer = null;

        const attemptRestore = async (attemptsLeft) => {
            const outcome = await fetchCurrentUser();
            if (cancelled) {
                return;
            }
            if (outcome === UNAVAILABLE && attemptsLeft > 0) {
                retryTimer = setTimeout(() => attemptRestore(attemptsLeft - 1), RESTORE_RETRY_MS);
                return;
            }
            setSessionChecked(true);
        };

        attemptRestore(RESTORE_ATTEMPTS - 1);

        return () => {
            cancelled = true;
            clearTimeout(retryTimer);
        };
    }, [authHeader, refreshToken, currentTenant]);

    // Keep the access token fresh while the app is open.
    useEffect(() => {
        if (!isAuthenticated) {
            return undefined;
        }

        return startTokenRefresh({
            getAuthHeader: () => authHeaderRef.current,
            refresh: async () => {
                const {rejected} = await refreshSession();
                if (rejected) {
                    handleSessionExpired();
                }
            },
        });
    }, [isAuthenticated, refreshSession, handleSessionExpired]);

    // Stored credentials without a cached user: the session is being restored, so
    // consumers should wait instead of treating it as logged out.
    const isRestoringSession = Boolean(authHeader || refreshToken) && !user && !sessionChecked;

    const loginSucceeded = async (accessToken, newRefreshToken) => {
        const newAuthHeader = applyTokens(accessToken, newRefreshToken);
        setIsAuthenticated(true);
        await fetchCurrentUser(newAuthHeader);
        return {success: true};
    };

    const handleLogin = async (username, password, otp) => {
        let body =
            `username=${encodeURIComponent(username)}` +
            `&password=${encodeURIComponent(password)}`;
        if (otp) {
            body += `&otp=${encodeURIComponent(otp)}`;
        }
        const response = await fetch(`${API_URL}/token`, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body,
        });

        if (response.ok) {
            const data = await response.json();
            return await loginSucceeded(data.access_token, data.refresh_token);
        } else if (response.status === 403) {
            const data = await response.json();
            return {otpUri: data.otp_uri};
        } else if (response.status === 401) {
            const data = await response.json();
            if (data.detail === 'Invalid MFA code') {
                return {invalidOtp: true};
            }
            clearSession();
            return {error: data.detail || 'Authentication failed'};
        } else {
            clearSession();
            return {error: 'Authentication failed'};
        }
    };

    const handleTelegramLogin = async (telegramUser) => {
        const response = await fetch(`${API_URL}/telegram-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(telegramUser)
        });

        if (response.ok) {
            const data = await response.json();
            return await loginSucceeded(data.access_token, data.refresh_token);
        } else {
            if (response.status === 404) {
                const errorData = await response.json();
                toast.error(`Authentication failed: ${errorData.detail}`);
            } else {
                toast.error('Authentication failed');
            }
            clearSession();
            return {error: 'Authentication failed'};
        }
    };

    const handleGoogleLogin = async (tokenResponse) => {
        try {
            const idToken = extractGoogleIdToken(tokenResponse);
            if (!idToken) {
                return;
            }
            const response = await fetch(`${API_URL}/google-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({token: idToken})
            });

            if (response.ok) {
                const data = await response.json();
                return await loginSucceeded(data.access_token, data.refresh_token);
            } else {
                if (response.status === 404) {
                    const errorData = await response.json();
                    toast.error(`Authentication failed: ${errorData.detail}`);
                } else {
                    toast.error('Authentication failed');
                }
                clearSession();
                return {error: 'Authentication failed'};
            }
        } catch (error) {
            console.error('Error during Google login', error);
            toast.error('Authentication failed');
            clearSession();
            return {error: 'Authentication failed'};
        }
    };

    const handleLogout = async () => {
        const tokenToRevoke = refreshTokenRef.current;
        const headerToUse = authHeaderRef.current;

        // Clear first, so nothing re-renders into a request carrying the token
        // that is about to be revoked. This also bumps the session generation, so a
        // refresh already in flight discards and revokes whatever it comes back
        // with rather than reviving the session we are leaving.
        clearSession();

        await revokeRefreshToken(tokenToRevoke, headerToUse);
    };

    return (
        <AuthContext value={{isAuthenticated, authHeader, refreshToken, currentTenant, handleLogin, handleTelegramLogin, handleGoogleLogin, handleLogout, handleSessionExpired, refreshSession, setCurrentTenant, setAuthHeader, setRefreshToken, user, isRestoringSession}}>
            {children}
        </AuthContext>
    );
};

export const useAuth = () => useContext(AuthContext);
