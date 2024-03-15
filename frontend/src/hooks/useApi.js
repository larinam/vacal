import { useAuth } from '../contexts/AuthContext';
import { useLoading } from './useLoading';

export const useApi = () => {
    const [isLoading, startLoading, stopLoading] = useLoading();
    const { authHeader, handleLogout } = useAuth();

    const apiCall = async (url, method = 'GET', body = null, isBlob = false, signal = null) => {
        const loadingTimer = startLoading();
        const fullUrl = `${process.env.REACT_APP_API_URL}${url}`;
        const options = {
            method,
            headers: {
                ...(authHeader ? { 'Authorization': authHeader } : {}),
                ...(!isBlob && { 'Content-Type': 'application/json' }), // Set content type to JSON unless it's a blob
            },
            ...(body && { body: JSON.stringify(body) }),
            signal,
        };

        try {
            const response = await fetch(fullUrl, options);
            if (response.status === 401) {
                handleLogout();
                return;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
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
            console.error('API call error:', error);
            throw error;
        } finally {
            stopLoading(loadingTimer);
        }
    };

    return { apiCall, isLoading };
};
