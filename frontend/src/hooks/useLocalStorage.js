import {useEffect, useRef, useState} from 'react';

const serialize = (value) => (typeof value === 'string' ? value : JSON.stringify(value));

const deserialize = (raw, fallback) => {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export const useLocalStorage = (key, defaultValue) => {
  const [value, setValue] = useState(() => deserialize(localStorage.getItem(key), defaultValue));
  // The raw string this hook last wrote or received. A storage event carrying it
  // is our own write coming back from the other tab, and applying it would
  // bounce the value between tabs forever.
  const lastRawRef = useRef(null);
  const defaultValueRef = useRef(defaultValue);

  useEffect(() => {
    if (value === undefined || value === null) {
      lastRawRef.current = null;
      localStorage.removeItem(key);
    } else {
      const raw = serialize(value);
      lastRawRef.current = raw;
      localStorage.setItem(key, raw);
    }
  }, [key, value]);

  // Keep tabs in sync. The refresh token rotates on every renewal, so a tab
  // still holding the previous value would fail its next refresh and log
  // everybody out of the shared storage.
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.storageArea && event.storageArea !== localStorage) return;
      if (event.key !== null && event.key !== key) return;

      const raw = event.key === null ? null : event.newValue;
      if (raw === lastRawRef.current) return;

      lastRawRef.current = raw;
      setValue(deserialize(raw, defaultValueRef.current));
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key]);

  return [value, setValue];
};
