import {useEffect, useState} from 'react';
import Modal from './Modal';
import './DeleteMemberModal.css';

const DeleteMemberModal = ({isOpen, memberName, onClose, onConfirm, isSubmitting = false}) => {
  const [confirmationName, setConfirmationName] = useState('');
  const [lastWorkingDay, setLastWorkingDay] = useState('');
  const [departureInitiatedBy, setDepartureInitiatedBy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfirmationName('');
      setLastWorkingDay('');
      setDepartureInitiatedBy('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    if (confirmationName.trim() !== memberName) {
      setError('The entered name did not match. Deletion cancelled.');
      return;
    }

    if (!lastWorkingDay) {
      setError('Please provide the last working day.');
      return;
    }

    if (!departureInitiatedBy) {
      setError('Please select who initiated the departure.');
      return;
    }

    setError('');
    onConfirm({lastWorkingDay, departureInitiatedBy});
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form className="deleteMemberModal" onSubmit={handleSubmit}>
        <h2>Delete team member</h2>
        <p className="deleteMemberModal__description">
          To confirm deletion, please type the name of the member: <strong>{memberName}</strong>
        </p>
        <label className="deleteMemberModal__label">
          Member name
          <input
            type="text"
            value={confirmationName}
            onChange={(event) => setConfirmationName(event.target.value)}
            placeholder={`Type '${memberName}' to confirm`}
            disabled={isSubmitting}
          />
        </label>
        <label className="deleteMemberModal__label">
          Last working day
          <input
            type="date"
            value={lastWorkingDay}
            onChange={(event) => setLastWorkingDay(event.target.value)}
            max={new Date().toISOString().split('T')[0]}
            disabled={isSubmitting}
            required
          />
        </label>
        <fieldset className="deleteMemberModal__choiceGroup" disabled={isSubmitting}>
          <legend>Who initiated this departure?</legend>
          <label className="deleteMemberModal__radio">
            <input
              type="radio"
              name="departureInitiatedBy"
              value="team_member"
              checked={departureInitiatedBy === 'team_member'}
              onChange={(event) => setDepartureInitiatedBy(event.target.value)}
              disabled={isSubmitting}
            />
            <span>The team member (voluntary resignation)</span>
          </label>
          <label className="deleteMemberModal__radio">
            <input
              type="radio"
              name="departureInitiatedBy"
              value="company"
              checked={departureInitiatedBy === 'company'}
              onChange={(event) => setDepartureInitiatedBy(event.target.value)}
              disabled={isSubmitting}
            />
            <span>The company (asked to leave)</span>
          </label>
        </fieldset>
        {error && <p className="deleteMemberModal__error" role="alert">{error}</p>}
        <div className="deleteMemberModal__buttons">
          <button type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="submit" disabled={isSubmitting}>Delete member</button>
        </div>
      </form>
    </Modal>
  );
};

export default DeleteMemberModal;
