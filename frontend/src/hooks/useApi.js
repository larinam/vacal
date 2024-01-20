import { useAuth } from '../contexts/AuthContext';
import { useLoading } from './useLoading';

export const useApi = () => {
    const [ isLoading, startLoading, stopLoading ] = useLoading();
    const { authHeader, onLogout } = useAuth();

    const apiCall = async ( url, method = 'GET', body = null ) => {
        const loadingTimer = startLoading();
        const fullUrl = `${process.env.REACT_APP_API_URL}${url}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            },
            ...(body && { body: JSON.stringify(body) })
        };

        try {
            const response = await fetch(fullUrl, options);
            if (response.status === 401) {
                onLogout();
                return;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        } finally {
            stopLoading(loadingTimer);
        }
    };

    return { apiCall, isLoading };
};
