import {useMutation, useQueryClient} from '@tanstack/react-query';
import {useApi} from '../useApi';
import {TEAMS_QUERY_KEY} from '../queries/useTeamsQuery';

const useMemberMutations = () => {
  const {apiCall} = useApi();
  const queryClient = useQueryClient();

  const invalidateTeams = () => {
    queryClient.invalidateQueries({queryKey: TEAMS_QUERY_KEY});
  };

  const createMemberMutation = useMutation({
    mutationFn: ({teamId, payload}) => apiCall(`/teams/${teamId}/members`, 'POST', payload),
    onSuccess: () => {
      invalidateTeams();
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({teamId, memberId, payload}) =>
      apiCall(`/teams/${teamId}/members/${memberId}`, 'PUT', payload),
    onSuccess: () => {
      invalidateTeams();
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: ({teamId, memberId, payload}) =>
      apiCall(`/teams/${teamId}/members/${memberId}`, 'DELETE', payload),
    onSuccess: () => {
      invalidateTeams();
    },
  });

  return {
    createMemberMutation,
    updateMemberMutation,
    deleteMemberMutation,
  };
};

export default useMemberMutations;
