import {useAuth} from '../contexts/AuthContext';
import {useLoading} from './useLoading';
import {useNavigate} from "react-router-dom";

export const useApi = () => {
    const [isLoading, startLoading, stopLoading] = useLoading();
    const { authHeader, handleLogout, currentTenant } = useAuth();
    const navigate = useNavigate();

    const apiCall = async (url, method = 'GET', body = null, isBlob = false, signal = null) => {
        const loadingTimer = startLoading();
        const fullUrl = `${process.env.REACT_APP_API_URL}${url}`;
        const options = {
            method,
            headers: {
                ...(authHeader ? { 'Authorization': authHeader } : {}),
                ...(!isBlob && { 'Content-Type': 'application/json' }), // Set content type to JSON unless it's a blob
                ...(currentTenant ? { 'Tenant-ID': currentTenant } : {}),
            },
            ...(body && { body: JSON.stringify(body) }),
            signal,
        };

        try {
            const response = await fetch(fullUrl, options);
            if (response.status === 401) {
                handleLogout();
                navigate('/');
                return;
            }
            if (!response.ok) {
                const error = new Error(`HTTP error! Status: ${response.status}`);
                error.data = await response.json();
                throw error;
            }

            if (isBlob) {
                // Handle blob data (file download)
                const blob = await response.blob();
                return blob;
            } else {
                // Handle JSON data
                const data = await response.json();
                return data;
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                // Silently handle aborted requests. This is the expected behaviour as of now.
                return {};
            }
            console.error('API call error:', error);
            throw error;
        } finally {
            stopLoading(loadingTimer);
        }
    };

    return { apiCall, isLoading };
};
