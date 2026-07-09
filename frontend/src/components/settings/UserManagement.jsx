import React, {useEffect, useState} from 'react';
import {useApi} from '../../hooks/useApi';
import UserModal from './UserModal';
import FontAwesomeIconWithTitle from '../FontAwesomeIconWithTitle';
import {faEdit, faKey, faTrashAlt, faSyncAlt, faLock} from '@fortawesome/free-solid-svg-icons';
import {useAuth} from '../../contexts/AuthContext';
import {useConfig} from '../../contexts/ConfigContext';
import {toast} from 'react-toastify';
import PasswordChangeModal from './PasswordChangeModal';
import ApiKeyModal from './ApiKeyModal';
import InviteUserModal from './InviteUserModal';
import InviteManagement from './InviteManagement';
import {useLocation, useNavigate} from 'react-router-dom';
import {extractGoogleIdToken} from '../../utils/google';
import {
  GoogleConnectButton,
  GoogleDisconnectButton,
  TelegramConnectButton,
  TelegramDisconnectButton,
} from './UserIntegrationButtons';
import useUserAccountMutations from '../../hooks/mutations/useUserAccountMutations';
import {useUsersQuery} from '../../hooks/queries/useUsersQuery';

const UserManagement = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {apiCall} = useApi();
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

  const {
    deleteUserMutation,
    googleConnectMutation,
    googleDisconnectMutation,
    telegramConnectMutation,
    telegramDisconnectMutation,
    resetMfaMutation,
  } = useUserAccountMutations();

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
      telegramConnectMutation.mutate(telegramUser, {
        onSuccess: () => setShowTelegramModal(false),
      });
    }
  };

  const handleTelegramDisconnect = () => {
    if (!telegramDisconnectMutation.isPending) {
      telegramDisconnectMutation.mutate();
    }
  };

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
                          <GoogleConnectButton
                            onConnect={handleGoogleConnect}
                            disabled={googleConnectMutation.isPending}
                          />
                        )}
                        {googleClientId && u.auth_details?.google_id && (
                          <GoogleDisconnectButton onDisconnect={handleGoogleDisconnect}/>
                        )}
                        {isTelegramEnabled && !u.auth_details?.telegram_id && (
                          <TelegramConnectButton
                            telegramBotUsername={telegramBotUsername}
                            isModalOpen={showTelegramModal}
                            onOpenModal={() => setShowTelegramModal(true)}
                            onCloseModal={() => setShowTelegramModal(false)}
                            onAuth={handleTelegramConnect}
                          />
                        )}
                        {isTelegramEnabled && u.auth_details?.telegram_id && (
                          <TelegramDisconnectButton onDisconnect={handleTelegramDisconnect}/>
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
