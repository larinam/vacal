import React, {useEffect, useRef, useState} from 'react';
import {useApi} from '../../hooks/useApi';

const UserModal = ({ isOpen, onClose, editingUser }) => {
    const [newUserData, setNewUserData] = useState({
        name: '',
        email: '',
        username: '',
        password: '',
        telegram_username: '',
    });
    const modalContentRef = useRef(null);
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
        } else {
            setNewUserData({
                name: '',
                email: '',
                username: '',
                password: '',
                telegram_username: '',
            });
        }
    }, [editingUser]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalContentRef.current && !modalContentRef.current.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const handleUserFormSubmit = async (e) => {
        e.preventDefault();
        console.log(editingUser)
        const method = editingUser ? 'PUT' : 'POST';
        const url = editingUser ? `/users/${editingUser._id}` : '/users';
        if (editingUser) {
            // Exclude password when editing
            delete newUserData.password;
        }
        try {
            await apiCall(url, method, newUserData);
            setNewUserData({
                name: '',
                email: '',
                username: '',
                password: '',
                telegram_username: '',
            });
            onClose();
        } catch (error) {
            console.error('Error adding/updating user:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal">
            <div className="modal-content" ref={modalContentRef}>
                <form onSubmit={handleUserFormSubmit}>
                    <input
                        type="text"
                        value={newUserData.name}
                        onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                        placeholder="Name"
                        required
                    />
                    <input
                        type="email"
                        value={newUserData.email}
                        onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                        placeholder="Email"
                        required
                    />
                    <input
                        type="text"
                        value={newUserData.username}
                        onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                        placeholder="Username"
                        required
                    />
                    { !editingUser && (
                        <input
                            type="password"
                            value={newUserData.password}
                            onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                            placeholder="Password"
                            required={!editingUser}
                        />
                    )}
                    <input
                        type="text"
                        value={newUserData.telegram_username}
                        onChange={(e) => setNewUserData({ ...newUserData, telegram_username: e.target.value })}
                        placeholder="Telegram Username"
                    />
                    <div className="button-container">
                        <button type="submit">{editingUser ? 'Update User' : 'Add User'}</button>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
