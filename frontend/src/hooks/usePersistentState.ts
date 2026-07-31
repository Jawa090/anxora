import { useState, useEffect } from 'react';

export function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error setting sessionStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState] as const;
}
