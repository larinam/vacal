import React, {useEffect, useState} from 'react';
import {useApi} from '../../hooks/useApi';
import UserModal from './UserModal'; // Consider renaming to UserModal
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faEdit, faTrashAlt} from '@fortawesome/free-solid-svg-icons';

const SettingsUserManagement = () => {
    const { apiCall } = useApi();
    const [users, setUsers] = useState([]);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const fetchUsers = async () => {
        try {
            const response = await apiCall('/users/');
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
                    {users.map((user, index) => (
                        <tr key={index}>
                            <td>{user.name}</td>
                            <td>{user.email}</td>
                            <td>{user.username}</td>
                            <td>{user.telegram_username || 'N/A'}</td>
                            <td>{user.disabled ? 'Disabled' : 'Active'}</td>
                            <td>
                                <FontAwesomeIcon icon={faEdit} onClick={() => handleEditUserClick(user)}/>
                                <FontAwesomeIcon icon={faTrashAlt} onClick={() => handleDeleteUser(user.id, user.name)} />
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
        </div>
    );
};

export default SettingsUserManagement;
