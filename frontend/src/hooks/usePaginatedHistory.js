import {useCallback, useMemo, useRef} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import {useApi} from './useApi';

const PAGE_SIZE = 100;

export const usePaginatedHistory = (isActive, endpoint) => {
  const {apiCall} = useApi();
  const listRef = useRef(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['paginatedHistory', endpoint],
    queryFn: ({pageParam = 0, signal}) =>
      apiCall(`${endpoint}?skip=${pageParam}&limit=${PAGE_SIZE}`, 'GET', null, false, signal),
    getNextPageParam: (lastPage, pages) => {
      if (!Array.isArray(lastPage) || lastPage.length < PAGE_SIZE) {
        return undefined;
      }
      const totalLoaded = pages.reduce((acc, page) => acc + page.length, 0);
      return totalLoaded;
    },
    enabled: Boolean(isActive && endpoint),
    initialPageParam: 0,
  });

  const history = useMemo(() => {
    if (!data?.pages) {
      return [];
    }
    return data.pages.flat();
  }, [data]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || isFetchingNextPage || !hasNextPage) {
      return;
    }
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return {
    history,
    listRef,
    handleScroll,
    isLoading,
    isFetchingNextPage,
    error,
  };
};
