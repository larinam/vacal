import React, {useEffect, useState} from 'react';
import {useApi} from '../hooks/useApi';
import Modal from './Modal';

const TeamModal = ({isOpen, onClose, editingTeam}) => {
  const [teamName, setTeamName] = useState('');
  const {apiCall} = useApi();

  useEffect(() => {
    if (editingTeam) {
      setTeamName(editingTeam.name);
    } else {
      setTeamName('');
    }
  }, [editingTeam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingTeam ? 'PUT' : 'POST';
    const url = editingTeam ? `/teams/${editingTeam._id}` : '/teams';

    const payload = {
      name: teamName,
    };

    try {
      await apiCall(url, method, payload);
      setTeamName('');
      onClose();
    } catch (error) {
      console.error('Error in team operation:', error);
    }
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
            <button type="submit">{editingTeam ? 'Update Team' : 'Add Team'}</button>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </form>
    </Modal>
  );
};

export default TeamModal;
