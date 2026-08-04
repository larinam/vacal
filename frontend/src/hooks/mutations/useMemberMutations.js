import {useMutation, useQueryClient} from '@tanstack/react-query';
import {useApi} from '../useApi';
import {TEAMS_QUERY_KEY} from '../queries/useTeamsQuery';
import {ARCHIVED_MEMBERS_QUERY_KEY} from '../queries/useArchivedMembersQuery';

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
    mutationFn: ({endpoint}) => apiCall(endpoint, 'DELETE'),
    onSuccess: () => {
      invalidateTeams();
    },
  });

  // Cancels a scheduled departure, or brings back a member archived by mistake. Also
  // invalidates the archived list, which the restore may have just removed a row from.
  const restoreMemberMutation = useMutation({
    mutationFn: ({teamId, memberId}) =>
      apiCall(`/teams/${teamId}/members/${memberId}/restore`, 'POST'),
    onSuccess: () => {
      invalidateTeams();
      queryClient.invalidateQueries({queryKey: ARCHIVED_MEMBERS_QUERY_KEY});
    },
  });

  return {
    createMemberMutation,
    updateMemberMutation,
    deleteMemberMutation,
    restoreMemberMutation,
  };
};

export default useMemberMutations;
