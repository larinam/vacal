import React, {useEffect, useState} from 'react';
import {useApi} from '../../hooks/useApi';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faTrashAlt} from '@fortawesome/free-solid-svg-icons';

const InviteManagement = ({ refreshTrigger }) => {
    const { apiCall } = useApi();
    const [invites, setInvites] = useState([]);

    const fetchInvites = async () => {
        try {
            const response = await apiCall('/users/invites');
            setInvites(response);
        } catch (error) {
            console.error('Error fetching invites:', error);
        }
    };

    const handleWithdrawInvite = async (inviteId, inviteEmail) => {
        const isConfirmed = window.confirm(`Are you sure you want to withdraw the invite for: ${inviteEmail}?`);
        if (isConfirmed) {
            try {
                await apiCall(`/users/invite/${inviteId}`, 'DELETE');
                fetchInvites(); // Refresh the invites list after withdrawal
            } catch (error) {
                console.error('Error withdrawing invite:', error);
            }
        }
    };

    useEffect(() => {
        fetchInvites();
    }, [refreshTrigger]);

    if (invites.length === 0) {
        return null; // Hide the component if there are no invites
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
              {invites.map((invite, index) => (
                <tr key={index}>
                    <td>{invite.email}</td>
                    <td>{invite.status}</td>
                    <td>{new Date(invite.expiration_date).toLocaleDateString()}</td>
                    <td>
                        <FontAwesomeIcon
                          icon={faTrashAlt}
                          onClick={() => handleWithdrawInvite(invite._id, invite.email)}
                          className="firstActionIcon"
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
