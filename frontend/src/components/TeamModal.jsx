import React, {useEffect, useState} from 'react';
import {useApi} from '../hooks/useApi';
import Modal from './Modal';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {TEAMS_QUERY_KEY} from '../hooks/queries/useTeamsQuery';

const TeamModal = ({isOpen, onClose, editingTeam}) => {
  const [teamName, setTeamName] = useState('');
  const {apiCall} = useApi();
  const queryClient = useQueryClient();

  const teamMutation = useMutation({
    mutationFn: ({url, method, payload}) => apiCall(url, method, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: TEAMS_QUERY_KEY});
      setTeamName('');
      onClose();
    },
    onError: (error) => {
      console.error('Error in team operation:', error);
    },
  });

  useEffect(() => {
    if (editingTeam) {
      setTeamName(editingTeam.name);
    } else {
      setTeamName('');
    }
  }, [editingTeam]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const method = editingTeam ? 'PUT' : 'POST';
    const url = editingTeam ? `/teams/${editingTeam._id}` : '/teams';

    const payload = {
      name: teamName,
    };

    teamMutation.mutate({url, method, payload});
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Enter team name"
            required
          />
          <div className="button-container">
            <button type="submit" disabled={teamMutation.isPending}>
              {editingTeam ? 'Update Team' : 'Add Team'}
            </button>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </form>
    </Modal>
  );
};

export default TeamModal;
