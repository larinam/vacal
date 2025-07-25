import {useMemo, useReducer} from 'react';
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

  // Used to force a re-render when setValue changes the storage
  const [, forceUpdate] = useReducer((c) => c + 1, 0);

  // Re-read the value whenever tenant changes or when storage updates
  const value = useMemo(readValue, [tenantKey, forceUpdate]);

  const setValue = (newValue) => {
    if (newValue === undefined || newValue === null) {
      localStorage.removeItem(tenantKey);
    } else {
      const toStore =
        typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
      localStorage.setItem(tenantKey, toStore);
    }
    forceUpdate();
  };

  return [value, setValue];
};
