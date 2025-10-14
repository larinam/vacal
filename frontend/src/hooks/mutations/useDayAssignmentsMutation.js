import {useMutation, useQueryClient} from '@tanstack/react-query';
import {useApi} from '../useApi';
import {TEAMS_QUERY_KEY} from '../queries/useTeamsQuery';

const useDayAssignmentsMutation = () => {
  const {apiCall} = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({teamId, memberId, payload}) =>
      apiCall(`/teams/${teamId}/members/${memberId}/days`, 'PUT', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: TEAMS_QUERY_KEY});
    },
  });
};

export default useDayAssignmentsMutation;
