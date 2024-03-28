import React, {createContext, useContext, useEffect, useState} from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({children}) => {
    const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem("isAuthenticated") === "true");
    const [authHeader, setAuthHeader] = useState(localStorage.getItem("authHeader") || '');

    useEffect(() => {
        localStorage.setItem("isAuthenticated", isAuthenticated);
        localStorage.setItem("authHeader", authHeader);
    }, [isAuthenticated, authHeader]);

    const handleLogin = async (username, password) => {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/token`, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        });

        if (response.ok) {
            const data = await response.json();
            setAuthHeader(`Bearer ${data.access_token}`);
            setIsAuthenticated(true);
        } else {
            alert('Authentication failed');
            setIsAuthenticated(false);
            setAuthHeader('');
        }
    };

    const handleTelegramLogin = async (telegramUser) => {
        const response = await fetch(`${process.env.REACT_APP_API_URL}telegram-login`, {
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
            alert('Authentication failed');
            setIsAuthenticated(false);
            setAuthHeader('');
        }
    }

    const handleLogout = () => {
        setIsAuthenticated(false);
        setAuthHeader('');
    };

    return (
        <AuthContext.Provider value={{isAuthenticated, authHeader, handleLogin, handleTelegramLogin, handleLogout}}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
