import { useState, useEffect, useRef } from 'react';
import { useApi } from './useApi';

export const usePaginatedHistory = (isActive, endpoint) => {
  const { apiCall } = useApi();
  const [history, setHistory] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const listRef = useRef(null);
  const limit = 100;

  const load = async (skip = 0, force = false) => {
    if (isFetching || (!hasMore && !force)) return;
    setIsFetching(true);
    try {
      const result = await apiCall(`${endpoint}?skip=${skip}&limit=${limit}`, 'GET');
      if (skip === 0) {
        setHistory(result);
      } else {
        setHistory((prev) => [...prev, ...result]);
      }
      if (result.length < limit) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    setHistory([]);
    setHasMore(true);
    load(0, true);
  }, [isActive, endpoint]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || isFetching || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
      load(history.length);
    }
  };

  return { history, listRef, handleScroll };
};

