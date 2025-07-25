import React, {useState} from 'react';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';
import './InviteUserModal.css';
import Modal from '../Modal';

const InviteUserModal = ({ isOpen, onClose }) => {
    const [inviteEmail, setInviteEmail] = useState('');
    const { apiCall } = useApi();


    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        try {
            await apiCall('/users/invite', 'POST', { email: inviteEmail });
            setInviteEmail('');
            onClose();
            toast.success('Invitation sent successfully');
        } catch (error) {
            console.error('Error sending invitation:', error);
            const detail = error?.data?.detail;
            if (detail === 'User already invited' ||
                detail === 'User with this email already exists in the Workspace') {
                toast.warn(detail);
            } else {
                toast.error('Failed to send invitation: ' + detail);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
                <form onSubmit={handleInviteSubmit}>
                    <input
                        autoFocus={true}
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Invite User Email"
                        required
                    />
                    <div className="button-container">
                        <button type="submit">Send Invitation</button>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                </form>
        </Modal>
    );
};

export default InviteUserModal;
