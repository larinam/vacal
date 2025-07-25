import {useEffect, useState} from 'react';
import {useAuth} from '../contexts/AuthContext';

export const useTenantLocalStorage = (key, defaultValue) => {
  const {currentTenant} = useAuth();
  const tenantKey = currentTenant ? `${currentTenant}_${key}` : key;

  const readValue = () => {
    const stored = localStorage.getItem(tenantKey);
    if (stored === null) return defaultValue;
    try {
      return JSON.parse(stored);
    } catch {
      return stored;
    }
  };

  const [value, setValue] = useState(readValue);

  // Update value when tenant changes
  useEffect(() => {
    setValue(readValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantKey]);

  // Persist value whenever it changes
  useEffect(() => {
    if (value === undefined || value === null) {
      localStorage.removeItem(tenantKey);
    } else {
      const toStore = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(tenantKey, toStore);
    }
  }, [tenantKey, value]);

  return [value, setValue];
};
