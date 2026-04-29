import {useQuery} from '@tanstack/react-query';

export const ARCHIVED_MEMBERS_QUERY_KEY = ['archivedMembers'];

export const useArchivedMembersQuery = (apiCall, options = {}) => {
  return useQuery({
    queryKey: ARCHIVED_MEMBERS_QUERY_KEY,
    queryFn: ({signal}) => apiCall('/teams/archived-members', 'GET', null, false, signal),
    ...options,
  });
};
