import React, {useEffect, useRef, useState} from 'react';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';
import './InviteUserModal.css';

const InviteUserModal = ({ isOpen, onClose }) => {
    const [inviteEmail, setInviteEmail] = useState('');
    const modalContentRef = useRef(null);
    const { apiCall } = useApi();

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

    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        try {
            await apiCall('/users/invite', 'POST', { email: inviteEmail });
            setInviteEmail('');
            onClose();
            toast.success('Invitation sent successfully');
        } catch (error) {
            console.error('Error sending invitation:', error);
            toast.error('Failed to send invitation: ' + error?.data?.detail);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal">
            <div className="modal-content" ref={modalContentRef}>
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
            </div>
        </div>
    );
};

export default InviteUserModal;
