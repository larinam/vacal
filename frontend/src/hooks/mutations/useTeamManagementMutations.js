import {useMutation, useQueryClient} from '@tanstack/react-query';
import {useApi} from '../useApi';
import {TEAMS_QUERY_KEY} from '../queries/useTeamsQuery';

const useTeamManagementMutations = () => {
  const {apiCall} = useApi();
  const queryClient = useQueryClient();

  const invalidateTeams = () => {
    queryClient.invalidateQueries({queryKey: TEAMS_QUERY_KEY});
  };

  const createTeamMutation = useMutation({
    mutationFn: ({payload}) => apiCall('/teams', 'POST', payload),
    onSuccess: invalidateTeams,
  });

  const updateTeamMutation = useMutation({
    mutationFn: ({teamId, payload}) => apiCall(`/teams/${teamId}`, 'PUT', payload),
    onSuccess: invalidateTeams,
  });

  const deleteTeamMutation = useMutation({
    mutationFn: ({teamId}) => apiCall(`/teams/${teamId}`, 'DELETE'),
    onSuccess: invalidateTeams,
  });

  const moveMemberMutation = useMutation({
    mutationFn: ({memberId, sourceTeamId, targetTeamId}) =>
      apiCall(`/teams/move-member/${memberId}`, 'POST', {
        source_team_id: sourceTeamId,
        target_team_id: targetTeamId,
      }),
    onSuccess: invalidateTeams,
  });

  return {createTeamMutation, updateTeamMutation, deleteTeamMutation, moveMemberMutation};
};

export default useTeamManagementMutations;
