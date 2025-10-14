import {useAuth} from '../contexts/AuthContext';
import {useCallback} from 'react';
import {useNavigate} from 'react-router-dom';
import {authedRequest} from '../utils/apiClient';

export const useApi = () => {
    const {authHeader, handleLogout, currentTenant} = useAuth();
    const navigate = useNavigate();

    const apiCall = useCallback(async (url, method = 'GET', body = null, isBlob = false, signal = null) => {
        try {
            const response = await authedRequest({
                endpoint: url,
                method,
                body,
                isBlob,
                authHeader,
                currentTenant,
                signal,
            });
            if (response.status === 401) {
                handleLogout();
                navigate('/');
                return;
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
    }, [authHeader, currentTenant, handleLogout, navigate]);

    return {apiCall};
};
