import React, {useEffect} from 'react';
import {useApi} from '../../hooks/useApi';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faTrashAlt} from '@fortawesome/free-solid-svg-icons';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {useInvitesQuery, INVITES_QUERY_KEY} from '../../hooks/queries/useInvitesQuery';

const InviteManagement = ({refreshTrigger}) => {
  const {apiCall} = useApi();
  const queryClient = useQueryClient();
  const {
    data: invites = [],
    isPending: isInvitesPending,
    error: invitesError,
    refetch,
  } = useInvitesQuery(apiCall, {staleTime: 0});

  useEffect(() => {
    if (refreshTrigger !== undefined) {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  useEffect(() => {
    if (invitesError) {
      console.error('Error fetching invites:', invitesError);
    }
  }, [invitesError]);

  const withdrawInviteMutation = useMutation({
    mutationFn: (inviteId) => apiCall(`/users/invite/${inviteId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: INVITES_QUERY_KEY});
    },
    onError: (error) => {
      console.error('Error withdrawing invite:', error);
    },
  });

  const handleWithdrawInvite = (inviteId, inviteEmail) => {
    if (withdrawInviteMutation.isPending) {
      return;
    }

    const isConfirmed = window.confirm(`Are you sure you want to withdraw the invite for: ${inviteEmail}?`);
    if (isConfirmed) {
      withdrawInviteMutation.mutate(inviteId);
    }
  };

  if (isInvitesPending && invites.length === 0) {
    return (
      <div className="inviteManagementContainer">
        <h3>Pending invites</h3>
        <p>Loading...</p>
      </div>
    );
  }

  if (!invites || invites.length === 0) {
    return null;
  }

  return (
    <div className="inviteManagementContainer">
      <h3>Pending invites ({invites.length})</h3>
      <table className="settingsTable">
        <thead>
        <tr>
          <th>Email</th>
          <th>Status</th>
          <th>Expiration Date</th>
          <th>Actions</th>
        </tr>
        </thead>
        <tbody>
        {invites.map((invite) => (
          <tr key={invite._id}>
            <td>{invite.email}</td>
            <td>{invite.status}</td>
            <td>{new Date(invite.expiration_date).toLocaleDateString()}</td>
            <td>
              <FontAwesomeIcon
                icon={faTrashAlt}
                onClick={() => handleWithdrawInvite(invite._id, invite.email)}
                className="firstActionIcon"
                title="Withdraw invite"
                aria-label="Withdraw invite"
              />
            </td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
};

export default InviteManagement;
