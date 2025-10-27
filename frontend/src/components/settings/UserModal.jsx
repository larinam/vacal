import React, {useEffect, useState} from 'react';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';
import Modal from '../Modal';
import {useAuth} from '../../contexts/AuthContext';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {USERS_QUERY_KEY} from '../../hooks/queries/useUsersQuery';

const DEFAULT_USER_STATE = {
  name: '',
  email: '',
  username: '',
  password: '',
  telegram_username: '',
  disabled: false,
  role: 'employee',
};

const UserModal = ({isOpen, onClose, editingUser}) => {
  const [newUserData, setNewUserData] = useState(DEFAULT_USER_STATE);
  const {apiCall} = useApi();
  const queryClient = useQueryClient();
  const {user: currentUser} = useAuth();
  const isEditingCurrentUser = Boolean(
    editingUser && currentUser && editingUser._id === currentUser._id,
  );

  useEffect(() => {
    if (editingUser) {
      setNewUserData({
        name: editingUser.name,
        email: editingUser.email,
        username: editingUser.username,
        password: '',
        telegram_username: editingUser.telegram_username || '',
        disabled: editingUser.disabled || false,
        role: editingUser.role || 'employee',
      });
    } else {
      setNewUserData(DEFAULT_USER_STATE);
    }
  }, [editingUser]);

  const updateUserMutation = useMutation({
    mutationFn: ({url, payload}) => apiCall(url, 'PUT', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: USERS_QUERY_KEY});
      toast.success('User updated successfully');
      onClose();
    },
    onError: (error) => {
      console.error('Error updating user:', error);
      const detail = error?.data?.detail;
      toast.error(detail || 'Error updating user');
    },
  });

  const handleUserFormSubmit = (e) => {
    e.preventDefault();
    if (!editingUser) {
      return;
    }
    const url = `/users/${editingUser._id}`;
    const payload = {
      ...newUserData,
      disabled: isEditingCurrentUser ? editingUser.disabled || false : newUserData.disabled,
    };
    updateUserMutation.mutate({url, payload});
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleUserFormSubmit}>
        <label>
          Name
          <input
            autoFocus={true}
            type="text"
            value={newUserData.name}
            onChange={(e) => setNewUserData({...newUserData, name: e.target.value})}
            placeholder="Enter name"
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={newUserData.email}
            onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
            placeholder="Enter email"
            required
          />
        </label>
        <label>
          Username
          <input
            type="text"
            value={newUserData.username}
            onChange={(e) => setNewUserData({...newUserData, username: e.target.value})}
            placeholder="Enter username"
            required
          />
        </label>
        <label>
          Telegram Username
          <input
            type="text"
            value={newUserData.telegram_username}
            onChange={(e) => setNewUserData({...newUserData, telegram_username: e.target.value})}
            placeholder="Enter Telegram username"
          />
        </label>
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={newUserData.disabled}
            onChange={(e) => {
              if (isEditingCurrentUser) {
                return;
              }
              setNewUserData({...newUserData, disabled: e.target.checked});
            }}
            disabled={isEditingCurrentUser}
            title={isEditingCurrentUser ? 'You cannot disable your own account' : undefined}
          />
          <span>Disabled</span>
        </label>
        {currentUser?.role === 'manager' && (
          <label>
            Role
            <select
              value={newUserData.role}
              onChange={(e) => setNewUserData({...newUserData, role: e.target.value})}
              disabled={isEditingCurrentUser}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </select>
          </label>
        )}
        <div className="button-container">
          <button type="button" onClick={onClose} disabled={updateUserMutation.isPending}>
            Close
          </button>
          <button type="submit" disabled={updateUserMutation.isPending}>
            Update User
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default UserModal;
