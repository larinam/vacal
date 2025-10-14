import {useCallback} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {useApi} from './useApi';
import {TEAMS_QUERY_KEY} from './queries/useTeamsQuery';

export const NOTIFICATION_TYPES_QUERY_KEY = ['notificationTypes'];
export const teamNotificationPreferencesKey = (teamId) => ['teamNotificationPreferences', teamId];

export const useTeamSubscription = () => {
  const {apiCall} = useApi();
  const queryClient = useQueryClient();

  const toggleTeamSubscription = useCallback(
    async (teamId, isSubscribed) => {
      const endpoint = isSubscribed
        ? `/teams/${teamId}/unsubscribe`
        : `/teams/${teamId}/subscribe`;
      await apiCall(endpoint, 'POST');
      queryClient.invalidateQueries({queryKey: TEAMS_QUERY_KEY});
    },
    [apiCall, queryClient],
  );

  const listNotificationTypes = useCallback(() => {
    return queryClient.ensureQueryData({
      queryKey: NOTIFICATION_TYPES_QUERY_KEY,
      queryFn: ({signal}) => apiCall('/teams/notification-types', 'GET', null, false, signal),
    });
  }, [apiCall, queryClient]);

  const getTeamNotificationPreferences = useCallback(
    (teamId) => {
      if (!teamId) {
        return Promise.resolve([]);
      }
      return queryClient.fetchQuery({
        queryKey: teamNotificationPreferencesKey(teamId),
        queryFn: ({signal}) =>
          apiCall(`/teams/${teamId}/notification-preferences`, 'GET', null, false, signal),
      });
    },
    [apiCall, queryClient],
  );

  const updateTeamNotificationPreferencesMutation = useMutation({
    mutationFn: ({teamId, notificationTypes}) =>
      apiCall(`/teams/${teamId}/notification-preferences`, 'PUT', {
        notification_types: notificationTypes,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({queryKey: teamNotificationPreferencesKey(variables.teamId)});
      queryClient.invalidateQueries({queryKey: TEAMS_QUERY_KEY});
    },
  });

  const updateTeamNotificationPreferences = useCallback(
    (teamId, notificationTypes) =>
      updateTeamNotificationPreferencesMutation.mutateAsync({teamId, notificationTypes}),
    [updateTeamNotificationPreferencesMutation],
  );

  return {
    toggleTeamSubscription,
    listNotificationTypes,
    getTeamNotificationPreferences,
    updateTeamNotificationPreferences,
    isUpdatingPreferences: updateTeamNotificationPreferencesMutation.isPending,
  };
};
