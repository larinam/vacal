import React, {useEffect, useState} from 'react';
import {useApi} from '../../hooks/useApi';
import UserModal from './UserModal';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faEdit, faKey, faTrashAlt, faSyncAlt} from '@fortawesome/free-solid-svg-icons';
import {useAuth} from "../../contexts/AuthContext";
import {toast} from 'react-toastify';
import PasswordChangeModal from "./PasswordChangeModal";
import InviteUserModal from './InviteUserModal';
import InviteManagement from './InviteManagement';
import {useLocation, useNavigate} from "react-router-dom";

const UserManagement = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {apiCall} = useApi();
  const {user} = useAuth(); // this is the current user
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [refreshInvites, setRefreshInvites] = useState(false);

  const query = new URLSearchParams(location.search);
  const inviteUser = query.get('inviteUser');


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
  }, [inviteUser]);

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

    // Remove inviteUser from the URL
    const params = new URLSearchParams(location.search);
    if (params.has('inviteUser')) {
      params.delete('inviteUser');
      navigate({
        pathname: location.pathname,
        search: params.toString(),
      });
    }
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
              />
              <FontAwesomeIcon icon={faTrashAlt}
                               onClick={() => handleDeleteUser(u._id, u.name)}
                               className="actionIcon"/>
              <FontAwesomeIcon icon={faSyncAlt}
                               onClick={() => handleResetMfa(u._id, u.name)}
                               className="actionIcon"/>
              {u._id === user._id && (
                <FontAwesomeIcon icon={faKey}
                                 onClick={() => handlePasswordChangeClick(u)}
                                 className="actionIcon"
                />
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
    </div>
  );
};

export default UserManagement;
