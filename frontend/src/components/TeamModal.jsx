import React, {useEffect, useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faBell as faSolidBell} from '@fortawesome/free-solid-svg-icons';
import {faBell as faRegularBell} from '@fortawesome/free-regular-svg-icons';
import {useAuth} from "../contexts/AuthContext";
import {useTeamSubscription} from '../hooks/useTeamSubscription';
import {useApi} from '../hooks/useApi';
import Modal from './Modal';

const TeamModal = ({isOpen, onClose, editingTeam}) => {
  const [teamName, setTeamName] = useState('');
  const [subscribers, setSubscribers] = useState([]);
  const {apiCall} = useApi();
  const {user} = useAuth();

  useEffect(() => {
    if (editingTeam) {
      setTeamName(editingTeam.name);
      fetchSubscribers(); // Fetch the subscribers when the modal opens
    } else {
      setTeamName('');
      setSubscribers([]);
    }
  }, [editingTeam]);


  const fetchSubscribers = async () => {
    if (!editingTeam) return;

    try {
      const response = await apiCall(`/teams/${editingTeam._id}/subscribers`, 'GET');
      setSubscribers(response); // Assuming the response is the list of subscribers
    } catch (error) {
      console.error('Error fetching subscribers:', error);
    }
  };

  const {toggleTeamSubscription} = useTeamSubscription();

  const handleSubscribeCurrentUser = async () => {
    if (!editingTeam) return;

    const isSubscribed = subscribers.some(subscriber => subscriber._id === user._id);

    try {
      await toggleTeamSubscription(editingTeam._id, isSubscribed);
      await fetchSubscribers(); // Reload subscribers after (un)subscribing
    } catch (error) {
      console.error(`Error ${isSubscribed ? 'unsubscribing' : 'subscribing'} current user:`, error);
    }
  };

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

  const isSubscribed = subscribers.some(subscriber => subscriber._id === user._id);

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
        {editingTeam && (
          <div className="subscribers-list">
            <h3>Watchers</h3>
            <button
              type="button"
              className="subscribe-button"
              onClick={handleSubscribeCurrentUser}
            >
              <FontAwesomeIcon icon={isSubscribed ? faSolidBell : faRegularBell} style={{marginRight: '5px'}}/>
              {isSubscribed ? 'Unwatch' : 'Watch'}
            </button>
            {subscribers.map(subscriber => (
              <div key={subscriber._id}>
                <span>{subscriber.name}</span>
              </div>
            ))}
          </div>
        )}
    </Modal>
  );
};

export default TeamModal;
