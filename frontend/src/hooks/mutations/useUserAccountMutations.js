import {useMutation, useQueryClient} from '@tanstack/react-query';
import {toast} from 'react-toastify';
import {useApi} from '../useApi';
import {USERS_QUERY_KEY} from '../queries/useUsersQuery';

const useUserAccountMutations = () => {
  const {apiCall} = useApi();
  const queryClient = useQueryClient();

  const invalidateUsers = () => queryClient.invalidateQueries({queryKey: USERS_QUERY_KEY});

  const detailError = (logPrefix, fallbackMessage) => (error) => {
    console.error(logPrefix, error);
    if (error.data && error.data.detail) {
      toast.error(error.data.detail);
    } else {
      toast.error(fallbackMessage);
    }
  };

  const deleteUserMutation = useMutation({
    mutationFn: ({userId}) => apiCall(`/users/${userId}`, 'DELETE'),
    onSuccess: (_, variables) => {
      invalidateUsers();
      if (variables.userName) {
        toast.success(`User '${variables.userName}' deleted`);
      }
    },
    onError: (error) => {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    },
  });

  const googleConnectMutation = useMutation({
    mutationFn: (idToken) => apiCall('/google-connect', 'POST', {token: idToken}),
    onSuccess: () => {
      toast.success('Google account connected');
      invalidateUsers();
    },
    onError: detailError('Error connecting Google account:', 'Error connecting Google account'),
  });

  const googleDisconnectMutation = useMutation({
    mutationFn: () => apiCall('/google-connect', 'DELETE'),
    onSuccess: () => {
      toast.success('Google account disconnected');
      invalidateUsers();
    },
    onError: detailError('Error disconnecting Google account:', 'Error disconnecting Google account'),
  });

  const telegramConnectMutation = useMutation({
    mutationFn: (telegramUser) => apiCall('/telegram-connect', 'POST', telegramUser),
    onSuccess: () => {
      toast.success('Telegram account connected');
      invalidateUsers();
    },
    onError: detailError('Error connecting Telegram account:', 'Error connecting Telegram account'),
  });

  const telegramDisconnectMutation = useMutation({
    mutationFn: () => apiCall('/telegram-connect', 'DELETE'),
    onSuccess: () => {
      toast.success('Telegram account disconnected');
      invalidateUsers();
    },
    onError: detailError('Error disconnecting Telegram account:', 'Error disconnecting Telegram account'),
  });

  const resetMfaMutation = useMutation({
    mutationFn: ({userId}) => apiCall(`/users/${userId}/reset-mfa`, 'POST'),
    onSuccess: (data) => {
      if (data?.message) {
        toast.success(data.message);
      } else {
        toast.success('MFA reset successfully');
      }
      invalidateUsers();
    },
    onError: detailError('Error resetting MFA:', 'Error resetting MFA'),
  });

  return {
    deleteUserMutation,
    googleConnectMutation,
    googleDisconnectMutation,
    telegramConnectMutation,
    telegramDisconnectMutation,
    resetMfaMutation,
  };
};

export default useUserAccountMutations;
