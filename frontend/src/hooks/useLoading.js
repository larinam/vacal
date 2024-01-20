import { useState } from 'react';

export const useLoading = () => {
    const [isLoading, setIsLoading] = useState(false);

    const startLoading = () => {
        return setTimeout(() => {
            setIsLoading(true);
        }, 100);
    };

    const stopLoading = (timer) => {
        clearTimeout(timer);
        setIsLoading(false);
    };

    return [isLoading, startLoading, stopLoading];
};