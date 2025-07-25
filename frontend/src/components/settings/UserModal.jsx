import React, {useEffect, useState} from 'react';
import {useApi} from '../../hooks/useApi';
import {toast} from "react-toastify";
import Modal from '../Modal';

const UserModal = ({ isOpen, onClose, editingUser }) => {
    const [newUserData, setNewUserData] = useState({
        name: '',
        email: '',
        username: '',
        password: '',
        telegram_username: '',
    });
    const { apiCall } = useApi();

    useEffect(() => {
        if (editingUser) {
            setNewUserData({
                name: editingUser.name,
                email: editingUser.email,
                username: editingUser.username,
                password: '',
                telegram_username: editingUser.telegram_username || '',
            });
        }
    }, [editingUser]);


    const handleUserFormSubmit = async (e) => {
        e.preventDefault();
        const method = 'PUT';
        const url = `/users/${editingUser._id}`;

        try {
            await apiCall(url, method, newUserData);
            onClose();
        } catch (error) {
            console.error('Error updating user:', error);
            toast.error(error);
        }
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
                            onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                            placeholder="Enter name"
                            required
                        />
                    </label>
                    <label>
                        Email
                        <input
                            type="email"
                            value={newUserData.email}
                            onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                            placeholder="Enter email"
                            required
                        />
                    </label>
                    <label>
                        Username
                        <input
                            type="text"
                            value={newUserData.username}
                            onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                            placeholder="Enter username"
                            required
                        />
                    </label>
                    <label>
                        Telegram Username
                        <input
                            type="text"
                            value={newUserData.telegram_username}
                            onChange={(e) => setNewUserData({ ...newUserData, telegram_username: e.target.value })}
                            placeholder="Enter Telegram username"
                        />
                    </label>
                    <div className="button-container">
                        <button type="submit">Update User</button>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                </form>
        </Modal>
    );
};

export default UserModal;
