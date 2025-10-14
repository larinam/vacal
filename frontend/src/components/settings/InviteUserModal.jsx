import React, {useState} from 'react';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';
import './InviteUserModal.css';
import Modal from '../Modal';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {USERS_QUERY_KEY} from '../../hooks/queries/useUsersQuery';

const InviteUserModal = ({isOpen, onClose}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const {apiCall} = useApi();
  const queryClient = useQueryClient();

  const inviteUserMutation = useMutation({
    mutationFn: (email) => apiCall('/users/invite', 'POST', {email}),
    onSuccess: () => {
      setInviteEmail('');
      toast.success('Invitation sent successfully');
      queryClient.invalidateQueries({queryKey: USERS_QUERY_KEY});
      onClose();
    },
    onError: (error) => {
      console.error('Error sending invitation:', error);
      const detail = error?.data?.detail;
      if (
        detail === 'User already invited' ||
        detail === 'User with this email already exists in the Workspace'
      ) {
        toast.warn(detail);
      } else {
        toast.error(`Failed to send invitation: ${detail || 'Unknown error'}`);
      }
    },
  });

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    inviteUserMutation.mutate(inviteEmail);
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
          <button type="button" onClick={onClose} disabled={inviteUserMutation.isPending}>
            Close
          </button>
          <button type="submit" disabled={inviteUserMutation.isPending}>
            Send Invitation
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default InviteUserModal;
