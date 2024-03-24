import React, { createContext, useContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem("isAuthenticated") === "true");
    const [authHeader, setAuthHeader] = useState(localStorage.getItem("authHeader") || '');

    useEffect(() => {
        localStorage.setItem("isAuthenticated", isAuthenticated);
        localStorage.setItem("authHeader", authHeader);
    }, [isAuthenticated, authHeader]);

    const handleLogin = (username, password) => {
        const encodedCredentials = btoa(`${username}:${password}`);
        setAuthHeader(`Basic ${encodedCredentials}`);
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setAuthHeader('');
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, authHeader, handleLogin, handleLogout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
