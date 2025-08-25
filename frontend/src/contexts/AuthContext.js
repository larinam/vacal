import React, {createContext, useContext, useEffect} from 'react';
import {toast} from 'react-toastify';
import {useLocalStorage} from '../hooks/useLocalStorage';

export const AuthContext = createContext();

export const AuthProvider = ({children}) => {
    const [isAuthenticated, setIsAuthenticated] = useLocalStorage('isAuthenticated', false);
    const [authHeader, setAuthHeader] = useLocalStorage('authHeader', '');
    const [currentTenant, setCurrentTenant] = useLocalStorage('currentTenant', '');
    const [user, setUser] = useLocalStorage('user', null);

    useEffect(() => {
        if (authHeader) {
            fetchCurrentUser();
        }
    }, [authHeader, currentTenant]);

    const fetchCurrentUser = async (token) => {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/users/me`, {
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


    const loginSucceeded = async (accessToken) => {
        const newAuthHeader = `Bearer ${accessToken}`;
        setAuthHeader(newAuthHeader);
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
        const response = await fetch(`${process.env.REACT_APP_API_URL}/token`, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body,
        });

        if (response.ok) {
            const data = await response.json();
            return await loginSucceeded(data.access_token);
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
            return {error: 'Authentication failed'};
        }
    };

    const handleTelegramLogin = async (telegramUser) => {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/telegram-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(telegramUser)
        });

        if (response.ok) {
            const data = await response.json();
            return await loginSucceeded(data.access_token);
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
    };

    const handleGoogleLogin = async (tokenResponse) => {
        try {
            const idToken = tokenResponse.id_token;
            if (!idToken) {
                toast.error('No ID token received from Google');
                return;
            }
            const response = await fetch(`${process.env.REACT_APP_API_URL}/google-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({token: idToken})
            });

            if (response.ok) {
                const data = await response.json();
                return await loginSucceeded(data.access_token);
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
            return {error: 'Authentication failed'};
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setAuthHeader('');
        setUser(null);
    };

    return (
        <AuthContext value={{isAuthenticated, authHeader, currentTenant, handleLogin, handleTelegramLogin, handleGoogleLogin, handleLogout, setCurrentTenant, user}}>
            {children}
        </AuthContext>
    );
};

export const useAuth = () => useContext(AuthContext);
