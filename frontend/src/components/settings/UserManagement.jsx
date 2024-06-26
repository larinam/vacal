import React, {useEffect, useState} from 'react';
import {useApi} from '../../hooks/useApi';
import UserModal from './UserModal';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faEdit, faKey, faTrashAlt} from '@fortawesome/free-solid-svg-icons';
import {useAuth} from "../../contexts/AuthContext";
import PasswordChangeModal from "./PasswordChangeModal";

const UserManagement = () => {
    const { apiCall } = useApi();
    const {user} = useAuth(); // this is a current user
    const [users, setUsers] = useState([]);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

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

    const handleAddUserClick = () => {
        setEditingUser(null); // Ensure no user data is set for adding new user
        setShowUserModal(true);
    };

    const handleEditUserClick = (user) => {
        setEditingUser(user); // Set the user data for editing
        setShowUserModal(true);
    };

    const handleModalClose = () => {
        setShowUserModal(false);
        fetchUsers(); // Refresh users after modal close
    };

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


    return (
        <div className="settingsUserManagementContainer">
            <h2>User Management Settings</h2>
            <button onClick={handleAddUserClick}>Add User</button>
            <table>
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
                            <td>{u.telegram_username || 'N/A'}</td>
                            <td>{u.disabled ? 'Disabled' : 'Active'}</td>
                            <td>
                                <FontAwesomeIcon icon={faEdit} onClick={() => handleEditUserClick(u)} />
                                <FontAwesomeIcon icon={faTrashAlt} onClick={() => handleDeleteUser(u._id, u.name)} />
                                {u._id === user._id && (
                                    <FontAwesomeIcon icon={faKey} onClick={() => handlePasswordChangeClick(u)} />
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
