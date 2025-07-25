import React, {useState} from 'react';
import {useApi} from '../../hooks/useApi';
import {toast} from "react-toastify";
import Modal from '../Modal';

const PasswordChangeModal = ({ isOpen, onClose }) => {
    const [passwords, setPasswords] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });
    const { apiCall } = useApi();

    const handlePasswordChangeSubmit = async (e) => {
        e.preventDefault();
        if (passwords.new_password !== passwords.confirm_password) {
            toast.warn("New passwords do not match");
            return;
        }
        try {
            await apiCall('/users/me/password', 'POST', passwords);
            toast("Password updated successfully");
            onClose();
        } catch (error) {
            console.error('Error updating password:', error);
            toast.error('Error updating password: ' + error?.data?.detail)
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
                <form onSubmit={handlePasswordChangeSubmit}>
                    <input
                        type="password"
                        value={passwords.current_password}
                        onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
                        placeholder="Current Password"
                        required
                    />
                    <input
                        type="password"
                        value={passwords.new_password}
                        onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                        placeholder="New Password"
                        required
                    />
                    <input
                        type="password"
                        value={passwords.confirm_password}
                        onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                        placeholder="Confirm New Password"
                        required
                    />
                    <div className="button-container">
                        <button type="submit">Change Password</button>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                </form>
        </Modal>
    );
};

export default PasswordChangeModal;
