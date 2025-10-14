import {useQuery} from '@tanstack/react-query';

export const INVITES_QUERY_KEY = ['invites'];

export const useInvitesQuery = (apiCall, options = {}) => {
  return useQuery({
    queryKey: INVITES_QUERY_KEY,
    queryFn: ({signal}) => apiCall('/users/invites', 'GET', null, false, signal),
    ...options,
  });
};
