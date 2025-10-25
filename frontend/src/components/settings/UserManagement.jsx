import React, {useEffect, useState} from 'react';
import {useApi} from '../../hooks/useApi';
import UserModal from './UserModal';
import FontAwesomeIconWithTitle from '../FontAwesomeIconWithTitle';
import {faEdit, faKey, faTrashAlt, faSyncAlt, faLock, faUnlink} from '@fortawesome/free-solid-svg-icons';
import {faGoogle, faTelegram} from '@fortawesome/free-brands-svg-icons';
import {useAuth} from '../../contexts/AuthContext';
import {useConfig} from '../../contexts/ConfigContext';
import {toast} from 'react-toastify';
import PasswordChangeModal from './PasswordChangeModal';
import ApiKeyModal from './ApiKeyModal';
import InviteUserModal from './InviteUserModal';
import InviteManagement from './InviteManagement';
import {useLocation, useNavigate} from 'react-router-dom';
import useGoogleAuth from '../../hooks/useGoogleAuth';
import {extractGoogleIdToken} from '../../utils/google';
import TelegramLogin from '../auth/TelegramLogin';
import Modal from '../Modal';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {useUsersQuery, USERS_QUERY_KEY} from '../../hooks/queries/useUsersQuery';

const UserManagement = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {apiCall} = useApi();
  const queryClient = useQueryClient();
  const {user} = useAuth();
  const {googleClientId, isTelegramEnabled, telegramBotUsername} = useConfig();
  const [showUserModal, setShowUserModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [refreshInvites, setRefreshInvites] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  const query = new URLSearchParams(location.search);
  const inviteUser = query.get('inviteUser');
  const profile = query.get('profile');

  const {
    data: users = [],
    isPending: isUsersPending,
    error: usersError,
  } = useUsersQuery(apiCall);

  useEffect(() => {
    if (inviteUser) {
      handleInviteUserClick();
    }
    if (profile && user) {
      handleEditUserClick(user);
    }
  }, [inviteUser, profile, user]);

  useEffect(() => {
    if (usersError) {
      console.error('Error fetching users:', usersError);
      toast.error('Failed to load users');
    }
  }, [usersError]);

  const invalidateUsers = () => queryClient.invalidateQueries({queryKey: USERS_QUERY_KEY});

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
    onError: (error) => {
      console.error('Error connecting Google account:', error);
      if (error.data && error.data.detail) {
        toast.error(error.data.detail);
      } else {
        toast.error('Error connecting Google account');
      }
    },
  });

  const googleDisconnectMutation = useMutation({
    mutationFn: () => apiCall('/google-connect', 'DELETE'),
    onSuccess: () => {
      toast.success('Google account disconnected');
      invalidateUsers();
    },
    onError: (error) => {
      console.error('Error disconnecting Google account:', error);
      if (error.data && error.data.detail) {
        toast.error(error.data.detail);
      } else {
        toast.error('Error disconnecting Google account');
      }
    },
  });

  const telegramConnectMutation = useMutation({
    mutationFn: (telegramUser) => apiCall('/telegram-connect', 'POST', telegramUser),
    onSuccess: () => {
      toast.success('Telegram account connected');
      setShowTelegramModal(false);
      invalidateUsers();
    },
    onError: (error) => {
      console.error('Error connecting Telegram account:', error);
      if (error.data && error.data.detail) {
        toast.error(error.data.detail);
      } else {
        toast.error('Error connecting Telegram account');
      }
    },
  });

  const telegramDisconnectMutation = useMutation({
    mutationFn: () => apiCall('/telegram-connect', 'DELETE'),
    onSuccess: () => {
      toast.success('Telegram account disconnected');
      invalidateUsers();
    },
    onError: (error) => {
      console.error('Error disconnecting Telegram account:', error);
      if (error.data && error.data.detail) {
        toast.error(error.data.detail);
      } else {
        toast.error('Error disconnecting Telegram account');
      }
    },
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
    onError: (error) => {
      console.error('Error resetting MFA:', error);
      if (error.data && error.data.detail) {
        toast.error(error.data.detail);
      } else {
        toast.error('Error resetting MFA');
      }
    },
  });

  const handleInviteUserClick = () => {
    setShowInviteModal(true);
  };

  const handleEditUserClick = (editing) => {
    setEditingUser(editing);
    setShowUserModal(true);
  };

  const handleModalClose = () => {
    setShowUserModal(false);
    setShowInviteModal(false);
    setRefreshInvites((prev) => !prev);

    const params = new URLSearchParams(location.search);
    if (params.has('inviteUser')) {
      params.delete('inviteUser');
    }
    if (params.has('profile')) {
      params.delete('profile');
    }
    navigate({
      pathname: location.pathname,
      search: params.toString(),
    });
  };

  const handleDeleteUser = (userId, userName) => {
    if (deleteUserMutation.isPending) {
      return;
    }
    const isConfirmed = window.confirm(`Are you sure you want to delete the user: ${userName}?`);
    if (isConfirmed) {
      deleteUserMutation.mutate({userId, userName});
    }
  };

  const handlePasswordChangeClick = () => {
    setShowPasswordModal(true);
  };

  const handleApiKeyClick = () => {
    setShowApiKeyModal(true);
  };

  const handleGoogleConnect = async (tokenResponse) => {
    if (googleConnectMutation.isPending) {
      return;
    }
    try {
      const idToken = extractGoogleIdToken(tokenResponse);
      if (!idToken) {
        return;
      }
      googleConnectMutation.mutate(idToken);
    } catch (error) {
      console.error('Error extracting Google token:', error);
      toast.error('Error connecting Google account');
    }
  };

  const handleGoogleDisconnect = () => {
    if (!googleDisconnectMutation.isPending) {
      googleDisconnectMutation.mutate();
    }
  };

  const handleTelegramConnect = (telegramUser) => {
    if (!telegramConnectMutation.isPending) {
      telegramConnectMutation.mutate(telegramUser);
    }
  };

  const handleTelegramDisconnect = () => {
    if (!telegramDisconnectMutation.isPending) {
      telegramDisconnectMutation.mutate();
    }
  };

  const GoogleConnectButton = () => {
    const googleConnect = useGoogleAuth(handleGoogleConnect);
    return (
      <FontAwesomeIconWithTitle
        icon={faGoogle}
        onClick={() => !googleConnectMutation.isPending && googleConnect()}
        className="actionIcon"
        title="Connect Google account"
        aria-label="Connect Google account"
      />
    );
  };

  const GoogleDisconnectButton = () => (
    <FontAwesomeIconWithTitle
      icon={faUnlink}
      onClick={handleGoogleDisconnect}
      className="actionIcon"
      title="Disconnect Google account"
      aria-label="Disconnect Google account"
    />
  );

  const TelegramConnectButton = () => (
    <>
      <FontAwesomeIconWithTitle
        icon={faTelegram}
        onClick={() => setShowTelegramModal(true)}
        className="actionIcon"
        title="Connect Telegram account"
        aria-label="Connect Telegram account"
      />
      <Modal isOpen={showTelegramModal} onClose={() => setShowTelegramModal(false)}>
        <TelegramLogin
          telegramBotUsername={telegramBotUsername}
          onAuth={handleTelegramConnect}
          title="Connect your Telegram account"
        />
      </Modal>
    </>
  );

  const TelegramDisconnectButton = () => (
    <FontAwesomeIconWithTitle
      icon={faUnlink}
      onClick={handleTelegramDisconnect}
      className="actionIcon"
      title="Disconnect Telegram account"
      aria-label="Disconnect Telegram account"
    />
  );

  const handleResetMfa = (userId, userName) => {
    if (resetMfaMutation.isPending) {
      return;
    }
    const isConfirmed = window.confirm(`Reset MFA for ${userName}?`);
    if (isConfirmed) {
      resetMfaMutation.mutate({userId});
    }
  };

  const userCount = Array.isArray(users) ? users.length : 0;
  const isInitialLoading = isUsersPending && userCount === 0;

  return (
    <div className="settingsUserManagementContainer">
      <h2>User Management Settings</h2>
      <InviteManagement refreshTrigger={refreshInvites}/>
      <h3>Users ({userCount})</h3>
      <div className="userManagementButtons">
        <button onClick={handleInviteUserClick}>Invite User</button>
      </div>
      <table className="settingsTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Username</th>
            <th>Telegram Username</th>
            <th>Google Email</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isInitialLoading ? (
            <tr>
              <td colSpan={7}>Loading...</td>
            </tr>
          ) : userCount === 0 ? (
            <tr>
              <td colSpan={7}>No users found.</td>
            </tr>
          ) : (
            users.map((u) => {
              const displayName = u.name || u.username || u.email || 'user';
              const editUserLabel = `Edit ${displayName}`;
              const deleteUserLabel = `Delete ${displayName}`;
              const resetMfaLabel = `Reset MFA for ${displayName}`;
              const isCurrentUser = u._id === user?._id;
              const changePasswordLabel = isCurrentUser ? 'Change your password' : 'Change password';
              const showApiKeyLabel = isCurrentUser ? 'Show your API key' : 'Show API key';

              return (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.username}</td>
                  <td>{u.telegram_username}</td>
                  <td>{u.auth_details?.google_email ?? ''}</td>
                  <td>{u.disabled ? 'Disabled' : 'Active'}</td>
                  <td>
                    <FontAwesomeIconWithTitle
                      icon={faEdit}
                      onClick={() => handleEditUserClick(u)}
                      className="firstActionIcon"
                      title={editUserLabel}
                      aria-label={editUserLabel}
                    />
                    <FontAwesomeIconWithTitle
                      icon={faTrashAlt}
                      onClick={() => handleDeleteUser(u._id, displayName)}
                      className="actionIcon"
                      title={deleteUserLabel}
                      aria-label={deleteUserLabel}
                    />
                    <FontAwesomeIconWithTitle
                      icon={faSyncAlt}
                      onClick={() => handleResetMfa(u._id, displayName)}
                      className="actionIcon"
                      title={resetMfaLabel}
                      aria-label={resetMfaLabel}
                    />
                    {isCurrentUser && (
                      <>
                        <FontAwesomeIconWithTitle
                          icon={faLock}
                          onClick={() => handlePasswordChangeClick(u)}
                          className="actionIcon"
                          title={changePasswordLabel}
                          aria-label={changePasswordLabel}
                        />
                        <FontAwesomeIconWithTitle
                          icon={faKey}
                          onClick={handleApiKeyClick}
                          className="actionIcon"
                          title={showApiKeyLabel}
                          aria-label={showApiKeyLabel}
                        />
                        {googleClientId && !u.auth_details?.google_id && (
                          <GoogleConnectButton/>
                        )}
                        {googleClientId && u.auth_details?.google_id && (
                          <GoogleDisconnectButton/>
                        )}
                        {isTelegramEnabled && !u.auth_details?.telegram_id && (
                          <TelegramConnectButton/>
                        )}
                        {isTelegramEnabled && u.auth_details?.telegram_id && (
                          <TelegramDisconnectButton/>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {showUserModal && (
        <UserModal
          isOpen={showUserModal}
          onClose={handleModalClose}
          editingUser={editingUser}
        />
      )}
      {showInviteModal && (
        <InviteUserModal
          isOpen={showInviteModal}
          onClose={handleModalClose}
        />
      )}
      {showPasswordModal && (
        <PasswordChangeModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
      {showApiKeyModal && (
        <ApiKeyModal
          isOpen={showApiKeyModal}
          onClose={() => setShowApiKeyModal(false)}
        />
      )}
    </div>
  );
};

export default UserManagement;
