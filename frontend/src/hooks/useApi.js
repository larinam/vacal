import {useAuth} from '../contexts/AuthContext';
import {useCallback} from 'react';
import {useNavigate} from 'react-router-dom';
import {authedRequest} from '../utils/apiClient';
import {refreshAccessToken} from '../utils/tokenRefresh';

export const useApi = () => {
    const {authHeader, refreshToken, handleLogout, currentTenant, setAuthHeader, setRefreshToken} = useAuth();
    const navigate = useNavigate();

    const apiCall = useCallback(async (url, method = 'GET', body = null, isBlob = false, signal = null) => {
        try {
            let response = await authedRequest({
                endpoint: url,
                method,
                body,
                isBlob,
                authHeader,
                currentTenant,
                signal,
            });
            
            // If 401, try to refresh token and retry
            if (response.status === 401 && refreshToken) {
                try {
                    const data = await refreshAccessToken(refreshToken);
                    const newAuthHeader = `Bearer ${data.access_token}`;
                    setAuthHeader(newAuthHeader);
                    setRefreshToken(data.refresh_token);
                    
                    // Retry the original request with new token
                    response = await authedRequest({
                        endpoint: url,
                        method,
                        body,
                        isBlob,
                        authHeader: newAuthHeader,
                        currentTenant,
                        signal,
                    });
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    handleLogout();
                    navigate('/');
                    return;
                }
            } else if (response.status === 401) {
                // No refresh token available, just logout
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
    }, [authHeader, refreshToken, currentTenant, handleLogout, navigate, setAuthHeader, setRefreshToken]);

    return {apiCall};
};
