import {useApi} from './useApi';

export const useTeamSubscription = () => {
  const {apiCall} = useApi();

  const toggleTeamSubscription = async (teamId, isSubscribed) => {
    const endpoint = isSubscribed
      ? `/teams/${teamId}/unsubscribe`
      : `/teams/${teamId}/subscribe`;
    await apiCall(endpoint, 'POST');
  };

  return {toggleTeamSubscription};
};
