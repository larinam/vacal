import {useQuery} from '@tanstack/react-query';

export const USERS_QUERY_KEY = ['users'];

export const useUsersQuery = (apiCall) => {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: ({signal}) => apiCall('/users', 'GET', null, false, signal),
  });
};
