import {useEffect, useState} from 'react';

export const useLocalStorage = (key, defaultValue) => {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    try {
      return JSON.parse(stored);
    } catch {
      return stored;
    }
  });

  useEffect(() => {
    if (value === undefined || value === null) {
      localStorage.removeItem(key);
    } else {
      const toStore = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, toStore);
    }
  }, [key, value]);

  return [value, setValue];
};
