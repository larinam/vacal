import {useEffect, useLayoutEffect, useState} from 'react';
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

  // Load the stored value as soon as the tenant changes
  useLayoutEffect(() => {
    setValue(readValue());
  }, [currentTenant]);

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
