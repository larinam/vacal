import {useCallback, useState} from 'react';

export const useLoading = () => {
    const [isLoading, setIsLoading] = useState(false);

    const startLoading = useCallback(() => {
        return setTimeout(() => {
            setIsLoading(true);
        }, 100);
    }, []);

    const stopLoading = useCallback((timer) => {
        clearTimeout(timer);
        setIsLoading(false);
    }, []);

    return [isLoading, startLoading, stopLoading];
};