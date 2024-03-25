import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';

const SettingsUserManagement = () => {
    const { apiCall } = useApi();
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await apiCall('/users/');
                setUsers(response);
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        };

        fetchUsers();
    }, [apiCall]);

    return (
        <div className="settingsUserManagementContainer">
            <h2>User Management Settings</h2>
            <table>
                <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Username</th>
                    <th>Telegram Username</th>
                    <th>Status</th>
                </tr>
                </thead>
                <tbody>
                    {users.map((user, index) => (
                        <tr key={index}>
                            <td>{user.name}</td>
                            <td>{user.email}</td>
                            <td>{user.username}</td>
                            <td>{user.telegram_username}</td>
                            <td>{user.disabled ? 'Disabled' : 'Active'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SettingsUserManagement;
