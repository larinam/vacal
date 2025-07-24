import React, {createContext, useContext, useEffect, useState} from 'react';
import {toast} from 'react-toastify';
import {useLocalStorage} from '../hooks/useLocalStorage';

export const AuthContext = createContext();

export const AuthProvider = ({children}) => {
    const [isAuthenticated, setIsAuthenticated] = useLocalStorage('isAuthenticated', false);
    const [authHeader, setAuthHeader] = useLocalStorage('authHeader', '');
    const [currentTenant, setCurrentTenant] = useLocalStorage('currentTenant', '');
    const [user, setUser] = useState(null);

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


    const handleLogin = async (username, password) => {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/token`, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        });

        if (response.ok) {
            const data = await response.json();
            const newAuthHeader = `Bearer ${data.access_token}`;
            setAuthHeader(newAuthHeader);
            setIsAuthenticated(true);
            await fetchCurrentUser(newAuthHeader);
        } else {
            toast('Authentication failed');
            setIsAuthenticated(false);
            setAuthHeader('');
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
            setAuthHeader(`Bearer ${data.access_token}`);
            setIsAuthenticated(true);
        } else {
            if (response.status === 404) {
                const errorData = await response.json();
                toast.error(`Authentication failed: ${errorData.detail}`);
            } else {
                toast.error('Authentication failed');
            }
            setIsAuthenticated(false);
            setAuthHeader('');
        }
    }

    const handleLogout = () => {
        setIsAuthenticated(false);
        setAuthHeader('');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{isAuthenticated, authHeader, currentTenant, handleLogin, handleTelegramLogin, handleLogout, setCurrentTenant, user}}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
