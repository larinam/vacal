import {useAuth} from '../contexts/AuthContext';
import {useCallback} from 'react';
import {useNavigate} from 'react-router-dom';
import {authedRequest} from '../utils/apiClient';

export const useApi = () => {
    const {authHeader, currentTenant, refreshSession, handleSessionExpired} = useAuth();
    const navigate = useNavigate();

    const apiCall = useCallback(async (url, method = 'GET', body = null, isBlob = false, signal = null) => {
        const sendRequest = (header) => authedRequest({
            endpoint: url,
            method,
            body,
            isBlob,
            authHeader: header,
            currentTenant,
            signal,
        });

        try {
            let response = await sendRequest(authHeader);

            // If 401, renew the short-lived access token and retry once
            if (response.status === 401) {
                const {header: renewedHeader, rejected} = await refreshSession();
                if (renewedHeader) {
                    response = await sendRequest(renewedHeader);
                } else if (!rejected) {
                    // The backend could not be reached to renew, so the session
                    // is probably still good - fail this call, keep the session.
                    throw new Error('Could not renew the session');
                }
            }

            if (response.status === 401) {
                handleSessionExpired();
                navigate('/');
                throw new Error('Session expired');
            }

            if (!response.ok) {
                const error = new Error(`HTTP error! Status: ${response.status}`);
                try {
                    error.data = await response.json();
                } catch {
                    // no-op if body can't be parsed
                }
                throw error;
            }

            if (isBlob) {
                return await response.blob();
            }
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                return {};
            }
            console.error('API call error:', error);
            throw error;
        }
    }, [authHeader, currentTenant, refreshSession, handleSessionExpired, navigate]);

    return {apiCall};
};
