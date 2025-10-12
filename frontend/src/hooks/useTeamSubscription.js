import {useCallback} from 'react';
import {useApi} from './useApi';

export const useTeamSubscription = () => {
  const {apiCall} = useApi();

  const toggleTeamSubscription = useCallback(async (teamId, isSubscribed) => {
    const endpoint = isSubscribed
      ? `/teams/${teamId}/unsubscribe`
      : `/teams/${teamId}/subscribe`;
    await apiCall(endpoint, 'POST');
  }, [apiCall]);

  const listNotificationTypes = useCallback(async () => {
    const response = await apiCall('/teams/notification-types');
    return response || [];
  }, [apiCall]);

  const getTeamNotificationPreferences = useCallback(async (teamId) => {
    if (!teamId) {
      return [];
    }
    const response = await apiCall(`/teams/${teamId}/notification-preferences`);
    return response || [];
  }, [apiCall]);

  const updateTeamNotificationPreferences = useCallback(async (teamId, notificationTypes) => {
    if (!teamId) {
      return {notification_types: []};
    }
    return await apiCall(`/teams/${teamId}/notification-preferences`, 'PUT', {
      notification_types: notificationTypes,
    });
  }, [apiCall]);

  return {
    toggleTeamSubscription,
    listNotificationTypes,
    getTeamNotificationPreferences,
    updateTeamNotificationPreferences,
  };
};
