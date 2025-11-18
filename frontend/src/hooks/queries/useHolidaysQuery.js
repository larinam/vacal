import {useQuery} from '@tanstack/react-query';

export const HOLIDAYS_QUERY_KEY = ['holidays'];

export const useHolidaysQuery = (apiCall, year, options = {}) => {
  return useQuery({
    queryKey: [...HOLIDAYS_QUERY_KEY, year],
    queryFn: ({signal}) => apiCall(`/teams/holidays?year=${year}`, 'GET', null, false, signal),
    ...options,
  });
};
