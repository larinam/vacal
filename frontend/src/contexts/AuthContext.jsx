import React, {createContext, useContext, useEffect, useRef} from 'react';
import {toast} from 'react-toastify';
import {extractGoogleIdToken} from '../utils/google';
import {useLocalStorage} from '../hooks/useLocalStorage';
import {API_URL} from '../utils/apiConfig';
import {setupTokenRefreshTimer} from '../utils/tokenRefresh';

export const AuthContext = createContext();

export const AuthProvider = ({children}) => {
    const [isAuthenticated, setIsAuthenticated] = useLocalStorage('isAuthenticated', false);
    const [authHeader, setAuthHeader] = useLocalStorage('authHeader', '');
    const [refreshToken, setRefreshToken] = useLocalStorage('refreshToken', '');
    const [currentTenant, setCurrentTenant] = useLocalStorage('currentTenant', '');
    const [user, setUser] = useLocalStorage('user', null);
    const refreshTimerRef = useRef(null);

    useEffect(() => {
        if (authHeader) {
            fetchCurrentUser();
        }
    }, [authHeader, currentTenant]);

    // Setup automatic token refresh
    useEffect(() => {
        if (isAuthenticated && refreshToken) {
            const onTokenRefreshed = (newAccessToken, newRefreshToken) => {
                setAuthHeader(`Bearer ${newAccessToken}`);
                setRefreshToken(newRefreshToken);
            };

            const onRefreshFailed = () => {
                toast.error('Session expired. Please log in again.');
                handleLogout();
            };

            refreshTimerRef.current = setupTokenRefreshTimer(
                refreshToken,
                onTokenRefreshed,
                onRefreshFailed
            );

            return () => {
                if (refreshTimerRef.current) {
                    clearInterval(refreshTimerRef.current);
                }
            };
        }
    }, [isAuthenticated, refreshToken]);

    const fetchCurrentUser = async (token) => {
        const response = await fetch(`${API_URL}/users/me`, {
            headers: {
                'Authorization': token || authHeader  // Use the token if provided, otherwise fallback to authHeader
            }
        });

        if (response.ok) {
            const userData = await response.json();
            setUser(userData);

            const tenantIdentifiers = userData.tenants.map(t => t.identifier);
            if (!currentTenant || !tenantIdentifiers.includes(currentTenant)) {
                setCurrentTenant(userData.tenants[0].identifier);
            }
        } else {
            console.error('Failed to fetch user data');
            handleLogout();
        }
    };


    const loginSucceeded = async (accessToken, newRefreshToken) => {
        const newAuthHeader = `Bearer ${accessToken}`;
        setAuthHeader(newAuthHeader);
        setRefreshToken(newRefreshToken);
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
            setIsAuthenticated(false);
            setAuthHeader('');
            return {error: data.detail || 'Authentication failed'};
        } else {
            setIsAuthenticated(false);
            setAuthHeader('');
            setRefreshToken('');
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
            setIsAuthenticated(false);
            setAuthHeader('');
            setRefreshToken('');
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
                setIsAuthenticated(false);
                setAuthHeader('');
                return {error: 'Authentication failed'};
            }
        } catch (error) {
            console.error('Error during Google login', error);
            toast.error('Authentication failed');
            setIsAuthenticated(false);
            setAuthHeader('');
            setRefreshToken('');
            return {error: 'Authentication failed'};
        }
    };

    const handleLogout = async () => {
        // Call logout endpoint to revoke refresh token
        if (refreshToken) {
            try {
                await fetch(`${API_URL}/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader,
                    },
                    body: JSON.stringify({refresh_token: refreshToken})
                });
            } catch (error) {
                console.error('Logout API call failed:', error);
            }
        }
        
        setIsAuthenticated(false);
        setAuthHeader('');
        setRefreshToken('');
        setUser(null);
    };

    return (
        <AuthContext value={{isAuthenticated, authHeader, refreshToken, currentTenant, handleLogin, handleTelegramLogin, handleGoogleLogin, handleLogout, setCurrentTenant, setAuthHeader, setRefreshToken, user}}>
            {children}
        </AuthContext>
    );
};

export const useAuth = () => useContext(AuthContext);
