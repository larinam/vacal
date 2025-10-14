import React, {useState} from 'react';
import {useApi} from '../../hooks/useApi';
import {toast} from "react-toastify";
import Modal from '../Modal';
import {useMutation} from '@tanstack/react-query';

const PasswordChangeModal = ({ isOpen, onClose }) => {
    const [passwords, setPasswords] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });
    const { apiCall } = useApi();
    const passwordChangeMutation = useMutation({
        mutationFn: (payload) => apiCall('/users/me/password', 'POST', payload),
    });

    const handlePasswordChangeSubmit = (e) => {
        e.preventDefault();
        if (passwords.new_password !== passwords.confirm_password) {
            toast.warn("New passwords do not match");
            return;
        }
        passwordChangeMutation.mutate(passwords, {
            onSuccess: () => {
                toast("Password updated successfully");
                onClose();
            },
            onError: (error) => {
                console.error('Error updating password:', error);
                const detail = error?.data?.detail;
                toast.error('Error updating password: ' + (detail || 'Unknown error'));
            },
        });
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
                        <button type="submit" disabled={passwordChangeMutation.isPending}>Change Password</button>
                        <button type="button" onClick={onClose} disabled={passwordChangeMutation.isPending}>Close</button>
                    </div>
                </form>
        </Modal>
    );
};

export default PasswordChangeModal;
