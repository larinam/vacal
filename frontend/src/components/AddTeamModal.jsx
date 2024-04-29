import React, {useEffect, useRef, useState} from 'react';
import {useApi} from '../hooks/useApi';

const AddTeamModal = ({isOpen, onClose, updateTeamData, editingTeam}) => {
  const [teamName, setTeamName] = useState('');
  const [subscriberEmails, setSubscriberEmails] = useState([]);
  const modalContentRef = useRef(null);
  const {apiCall} = useApi();

  useEffect(() => {
    if (editingTeam) {
      setTeamName(editingTeam.name);
      setSubscriberEmails(editingTeam.subscriber_emails || []);
    } else {
      setTeamName('');
      setSubscriberEmails([]);
    }
  }, [editingTeam]);

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

  const handleEmailChange = (event, index) => {
    const newEmails = [...subscriberEmails];
    newEmails[index] = event.target.value;
    setSubscriberEmails(newEmails);
  };

  const addEmailField = () => {
    setSubscriberEmails([...subscriberEmails, '']);
  };

  const removeEmailField = index => {
    const newEmails = [...subscriberEmails];
    newEmails.splice(index, 1);
    setSubscriberEmails(newEmails);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingTeam ? 'PUT' : 'POST';
    const url = editingTeam ? `/teams/${editingTeam._id}` : '/teams';

    const payload = {
      name: teamName,
      subscriber_emails: subscriberEmails.filter(email => email) // Filter out empty emails
    };

    try {
      await apiCall(url, method, payload);
      setTeamName('');
      setSubscriberEmails([]);
      onClose();
      updateTeamData(); // Refresh data
    } catch (error) {
      console.error('Error in team operation:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content" ref={modalContentRef}>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Enter team name"
            required
          />
          {subscriberEmails.map((email, index) => (
            <div key={index} className="email-input">
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e, index)}
                placeholder="Enter subscriber email"
                required
              />
              <button type="button" onClick={() => removeEmailField(index)}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={addEmailField}>Add Email</button>
          <div className="button-container">
            <button type="submit">{editingTeam ? 'Update Team' : 'Add Team'}</button>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTeamModal;
