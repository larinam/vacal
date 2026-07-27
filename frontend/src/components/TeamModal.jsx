import React, {useEffect, useMemo, useState} from 'react';
import {toast} from 'react-toastify';
import Modal from './Modal';
import useTeamManagementMutations from '../hooks/mutations/useTeamManagementMutations';
import {getApiErrorMessage} from '../utils/apiErrors';
import {buildParentTeamOptions} from '../utils/teamHierarchy';

const TeamModal = ({isOpen, onClose, editingTeam, teams = [], canEditHierarchy = false}) => {
  const [teamName, setTeamName] = useState('');
  const [parentTeamId, setParentTeamId] = useState('');
  const {createTeamMutation, updateTeamMutation} = useTeamManagementMutations();

  // The picker offers every team, cycle-safe: the edited team and its whole
  // subtree are excluded so a parent can never be chosen from below.
  const parentOptions = useMemo(
    () => buildParentTeamOptions(teams, editingTeam?._id),
    [teams, editingTeam]
  );

  useEffect(() => {
    if (editingTeam) {
      setTeamName(editingTeam.name);
      // Coerce the nullable backend field so the select stays controlled.
      setParentTeamId(editingTeam.parent_team_id ?? '');
    } else {
      setTeamName('');
      setParentTeamId('');
    }
  }, [editingTeam]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const payload = {name: teamName};
    // Omitted for non-managers so the backend keeps the stored parent instead of
    // rejecting a rename they are otherwise allowed to make.
    if (canEditHierarchy) {
      payload.parent_team_id = parentTeamId || null;
    }

    const mutation = editingTeam ? updateTeamMutation : createTeamMutation;
    const variables = editingTeam ? {teamId: editingTeam._id, payload} : {payload};

    mutation.mutate(variables, {
      onSuccess: () => {
        toast.success(editingTeam ? 'Team updated successfully' : 'Team added successfully');
        setTeamName('');
        setParentTeamId('');
        onClose();
      },
      onError: (error) => {
        console.error('Error in team operation:', error);
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  if (!isOpen) return null;

  const isPending = createTeamMutation.isPending || updateTeamMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name"
              required
            />
          </label>
          <label>
            Parent team
            <select
              value={parentTeamId}
              onChange={(e) => setParentTeamId(e.target.value)}
              disabled={!canEditHierarchy}
              title={canEditHierarchy ? undefined : 'Only managers can change the team hierarchy'}
            >
              <option value="">None</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="button-container">
            <button type="button" onClick={onClose}>Close</button>
            <button type="submit" disabled={isPending}>
              {editingTeam ? 'Update Team' : 'Add Team'}
            </button>
          </div>
        </form>
    </Modal>
  );
};

export default TeamModal;
