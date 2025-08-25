import React, {useEffect, useState} from 'react';
import {useApi} from '../../hooks/useApi';
import UserModal from './UserModal';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faEdit, faKey, faTrashAlt, faSyncAlt, faLock} from '@fortawesome/free-solid-svg-icons';
import {useAuth} from "../../contexts/AuthContext";
import {useConfig} from "../../contexts/ConfigContext";
import {toast} from 'react-toastify';
import PasswordChangeModal from "./PasswordChangeModal";
import ApiKeyModal from './ApiKeyModal';
import InviteUserModal from './InviteUserModal';
import InviteManagement from './InviteManagement';
import {useLocation, useNavigate} from "react-router-dom";
import {faGoogle} from '@fortawesome/free-brands-svg-icons';
import useGoogleAuth from '../../hooks/useGoogleAuth';

const UserManagement = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {apiCall} = useApi();
  const {user} = useAuth(); // this is the current user
  const {googleClientId} = useConfig();
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [refreshInvites, setRefreshInvites] = useState(false);

  const query = new URLSearchParams(location.search);
  const inviteUser = query.get('inviteUser');
  const profile = query.get('profile');


  const fetchUsers = async () => {
    try {
      const response = await apiCall('/users');
      setUsers(response);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (inviteUser) {
      handleInviteUserClick();
    }
    if (profile) {
      handleEditUserClick(user);
    }
  }, [inviteUser, profile]);

  const handleInviteUserClick = () => {
    setShowInviteModal(true);
  };

  const handleEditUserClick = (user) => {
    setEditingUser(user); // Set the user data for editing
    setShowUserModal(true);
  };

  const handleModalClose = () => {
    setShowUserModal(false);
    setShowInviteModal(false);
    fetchUsers();
    setRefreshInvites(!refreshInvites); // Trigger refresh of invites

    // Remove inviteUser/profile from the URL
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
  }

  const handleDeleteUser = async (userId, userName) => {
    const isConfirmed = window.confirm(`Are you sure you want to delete the user: ${userName}?`);
    if (isConfirmed) {
      try {
        await apiCall(`/users/${userId}`, 'DELETE');
        fetchUsers(); // Refresh the user list after deletion
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const handlePasswordChangeClick = () => {
    setShowPasswordModal(true);
  };

  const handleApiKeyClick = () => {
    setShowApiKeyModal(true);
  };

  const handleGoogleConnect = async (tokenResponse) => {
    try {
      const idToken = tokenResponse.id_token;
      if (!idToken) {
        toast.error('No ID token received from Google');
        return;
      }
      await apiCall('/google-connect', 'POST', {token: idToken});
      toast.success('Google account connected');
      fetchUsers();
    } catch (error) {
      console.error('Error connecting Google account:', error);
      if (error.data && error.data.detail) {
        toast.error(error.data.detail);
      } else {
        toast.error('Error connecting Google account');
      }
    }
  };

  const GoogleConnectButton = () => {
    const googleConnect = useGoogleAuth(handleGoogleConnect);
    return (
      <FontAwesomeIcon icon={faGoogle}
                       onClick={() => googleConnect()}
                       className="actionIcon"
                       title="Connect Google account"
                       aria-label="Connect Google account"
      />
    );
  };

  const handleResetMfa = async (userId, userName) => {
    const isConfirmed = window.confirm(`Reset MFA for ${userName}?`);
    if (isConfirmed) {
      try {
        const data = await apiCall(`/users/${userId}/reset-mfa`, 'POST');
        toast.success(data.message);
        fetchUsers();
      } catch (error) {
        console.error('Error resetting MFA:', error);
        if (error.data && error.data.detail) {
          toast.error(error.data.detail);
        } else {
          toast.error('Error resetting MFA');
        }
      }
    }
  };

  return (
    <div className="settingsUserManagementContainer">
      <h2>User Management Settings</h2>
      <InviteManagement refreshTrigger={refreshInvites}/>
      <h3>Users ({users.length})</h3>
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
          <th>Status</th>
          <th>Actions</th>
        </tr>
        </thead>
        <tbody>
        {users.map((u, index) => (
          <tr key={index}>
            <td>{u.name}</td>
            <td>{u.email}</td>
            <td>{u.username}</td>
            <td>{u.telegram_username}</td>
            <td>{u.disabled ? 'Disabled' : 'Active'}</td>
            <td>
              <FontAwesomeIcon icon={faEdit}
                               onClick={() => handleEditUserClick(u)}
                               className="firstActionIcon"
                               title="Edit user"
                               aria-label="Edit user"
              />
              <FontAwesomeIcon icon={faTrashAlt}
                               onClick={() => handleDeleteUser(u._id, u.name)}
                               className="actionIcon"
                               title="Delete user"
                               aria-label="Delete user"/>
              <FontAwesomeIcon icon={faSyncAlt}
                               onClick={() => handleResetMfa(u._id, u.name)}
                               className="actionIcon"
                               title="Reset MFA"
                               aria-label="Reset MFA"/>
              {u._id === user._id && (
                <>
                  <FontAwesomeIcon icon={faLock}
                                   onClick={() => handlePasswordChangeClick(u)}
                                   className="actionIcon"
                                   title="Change password"
                                   aria-label="Change password"
                  />
                  <FontAwesomeIcon icon={faKey}
                                   onClick={handleApiKeyClick}
                                   className="actionIcon"
                                   title="Show API key"
                                   aria-label="Show API key"
                  />
                  {googleClientId && !u.auth_details?.google_id && (
                    <GoogleConnectButton/>
                  )}
                </>
              )}
            </td>
          </tr>
        ))}
        </tbody>
      </table>
      {showUserModal && (
        <UserModal
          isOpen={showUserModal}
          onClose={handleModalClose}
          editingUser={editingUser} // Pass editing user data to the modal
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
