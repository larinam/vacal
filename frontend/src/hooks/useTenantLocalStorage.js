import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocalStorage } from './useLocalStorage';

export const useTenantLocalStorage = (key, defaultValue) => {
  const { currentTenant } = useAuth();
  const tenantKey = currentTenant ? `${currentTenant}_${key}` : key;
  const [value, setValue] = useLocalStorage(tenantKey, defaultValue);

  useEffect(() => {
    const stored = localStorage.getItem(tenantKey);
    if (stored === null) {
      setValue(defaultValue);
    } else {
      try {
        setValue(JSON.parse(stored));
      } catch {
        setValue(stored);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantKey]);

  return [value, setValue];
};
