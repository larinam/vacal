import React, {createContext, useContext, useEffect, useState} from 'react';
import {toast} from 'react-toastify';

export const AuthContext = createContext();

export const AuthProvider = ({children}) => {
    const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem("isAuthenticated") === "true");
    const [authHeader, setAuthHeader] = useState(localStorage.getItem("authHeader") || '');
    const [currentTenant, setCurrentTenant] = useState(localStorage.getItem("currentTenant") || '');
    const [user, setUser] = useState(null);

    useEffect(() => {
        localStorage.setItem("isAuthenticated", isAuthenticated);
        localStorage.setItem("authHeader", authHeader);
        if (currentTenant) {
            localStorage.setItem("currentTenant", currentTenant);
        }
        if (authHeader) {
            fetchCurrentUser();
        }
    }, [isAuthenticated, authHeader, currentTenant]);

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
    };

    const webAuthnBufferToBase64Url = (buffer) => {
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    const webAuthnBase64UrlToBuffer = (b64url) => {
        const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
        return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    };

    const handleWebAuthnLogin = async (username) => {
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/webauthn/authenticate-options`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username})
            });
            if (!res.ok) throw new Error();
            const options = await res.json();
            options.challenge = webAuthnBase64UrlToBuffer(options.challenge);
            if (options.allowCredentials) {
                options.allowCredentials = options.allowCredentials.map(c => ({...c, id: webAuthnBase64UrlToBuffer(c.id)}));
            }
            const cred = await navigator.credentials.get({publicKey: options});
            const credential = {
                id: webAuthnBufferToBase64Url(cred.rawId),
                rawId: webAuthnBufferToBase64Url(cred.rawId),
                type: cred.type,
                response: {
                    clientDataJSON: webAuthnBufferToBase64Url(cred.response.clientDataJSON),
                    authenticatorData: webAuthnBufferToBase64Url(cred.response.authenticatorData),
                    signature: webAuthnBufferToBase64Url(cred.response.signature)
                }
            };
            const res2 = await fetch(`${process.env.REACT_APP_API_URL}/webauthn/authenticate`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username, credential})
            });
            if (!res2.ok) throw new Error();
            const data = await res2.json();
            const newAuthHeader = `Bearer ${data.access_token}`;
            setAuthHeader(newAuthHeader);
            setIsAuthenticated(true);
            await fetchCurrentUser(newAuthHeader);
            return true;
        } catch (e) {
            toast.error('Authentication failed');
            return false;
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setAuthHeader('');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{isAuthenticated, authHeader, currentTenant, handleLogin, handleTelegramLogin, handleWebAuthnLogin, handleLogout, setCurrentTenant, user}}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
