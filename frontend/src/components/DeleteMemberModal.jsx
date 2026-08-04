import {useEffect, useState} from 'react';
import {format} from 'date-fns';
import Modal from './Modal';
import './DeleteMemberModal.css';

const DeleteMemberModal = ({
                             isOpen,
                             memberName,
                             employeeStartDate = '',
                             scheduledLastWorkingDay = '',
                             onClose,
                             onConfirm,
                             onCancelSeparation,
                             isSubmitting = false,
                           }) => {
  const [confirmationName, setConfirmationName] = useState('');
  const [lastWorkingDay, setLastWorkingDay] = useState('');
  const [separationType, setSeparationType] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfirmationName('');
      setLastWorkingDay(scheduledLastWorkingDay || '');
      setSeparationType('');
      setError('');
    }
  }, [isOpen, scheduledLastWorkingDay]);

  if (!isOpen) {
    return null;
  }

  // Local, not UTC: new Date().toISOString() reads yesterday late in the evening east of
  // UTC, which is the off-by-one the old max attribute suffered from.
  const today = format(new Date(), 'yyyy-MM-dd');
  const isFutureDeparture = Boolean(lastWorkingDay) && lastWorkingDay >= today;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (confirmationName.trim() !== memberName) {
      setError('The entered name did not match. No changes were made.');
      return;
    }

    if (!lastWorkingDay) {
      setError('Please provide the last working day.');
      return;
    }

    // The min attribute below only constrains the picker, so the real check lives here.
    if (employeeStartDate && lastWorkingDay < employeeStartDate) {
      setError(`The last working day cannot be before the start date (${employeeStartDate}).`);
      return;
    }

    setError('');
    onConfirm({
      lastWorkingDay,
      separationType,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* noValidate so every rejection surfaces through the same inline role="alert"
          message. Otherwise the browser's own tooltip handles the date bounds while the
          name mismatch uses our text, and the two disagree in wording and placement. */}
      <form className="deleteMemberModal" onSubmit={handleSubmit} noValidate>
        <h2>Schedule member departure</h2>
        <p className="deleteMemberModal__description">
          To confirm this departure, please type the name of the member: <strong>{memberName}</strong>
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
            min={employeeStartDate || undefined}
            disabled={isSubmitting}
            required
          />
        </label>
        {isFutureDeparture && (
          <p className="deleteMemberModal__hint">
            {memberName} stays on the calendar until {lastWorkingDay}, then moves to
            Archived members. Their vacation allowance is prorated to that date.
          </p>
        )}
        <fieldset className="deleteMemberModal__choiceGroup" disabled={isSubmitting}>
          <legend>Separation type (optional)</legend>
          {[
            {value: 'resignation',       label: 'Resignation (voluntary)'},
            {value: 'termination',       label: 'Termination by employer'},
            {value: 'redundancy',        label: 'Redundancy / position eliminated'},
            {value: 'mutual_agreement',  label: 'Mutual agreement'},
            {value: 'end_of_contract',   label: 'End of fixed-term contract'},
            {value: 'retirement',        label: 'Retirement'},
          ].map(({value, label}) => (
            <label key={value} className="deleteMemberModal__radio">
              <input
                type="radio"
                name="separationType"
                value={value}
                checked={separationType === value}
                onChange={(event) => setSeparationType(event.target.value)}
                disabled={isSubmitting}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        {error && <p className="deleteMemberModal__error" role="alert">{error}</p>}
        <div className="deleteMemberModal__buttons">
          <button type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          {scheduledLastWorkingDay && onCancelSeparation && (
            <button type="button" onClick={onCancelSeparation} disabled={isSubmitting}>
              Cancel scheduled departure
            </button>
          )}
          <button type="submit" disabled={isSubmitting}>
            {isFutureDeparture ? 'Schedule departure' : 'Delete member'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default DeleteMemberModal;
