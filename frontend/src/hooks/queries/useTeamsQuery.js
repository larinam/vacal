import {useQuery} from '@tanstack/react-query';

export const TEAMS_QUERY_KEY = ['teams'];

export const useTeamsQuery = (apiCall) => {
  return useQuery({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: ({signal}) => apiCall('/teams', 'GET', null, false, signal),
  });
};
