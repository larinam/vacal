import {useQuery} from '@tanstack/react-query';

export const DAY_TYPES_QUERY_KEY = ['dayTypes'];

export const useDayTypesQuery = (apiCall) => {
  return useQuery({
    queryKey: DAY_TYPES_QUERY_KEY,
    queryFn: ({signal}) => apiCall('/daytypes', 'GET', null, false, signal),
    select: (response) => response?.day_types ?? [],
  });
};
