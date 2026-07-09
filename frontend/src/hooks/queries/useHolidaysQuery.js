import {useQuery} from '@tanstack/react-query';

export const HOLIDAYS_QUERY_KEY = ['holidays'];

export const holidaysQueryOptions = (apiCall, year) => ({
  queryKey: [...HOLIDAYS_QUERY_KEY, year],
  queryFn: ({signal}) => apiCall(`/teams/holidays?year=${year}`, 'GET', null, false, signal),
});

export const useHolidaysQuery = (apiCall, year, options = {}) => {
  return useQuery({
    ...holidaysQueryOptions(apiCall, year),
    ...options,
  });
};
