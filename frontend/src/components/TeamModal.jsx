import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faBell as faSolidBell} from '@fortawesome/free-solid-svg-icons';
import {faBell as faRegularBell} from '@fortawesome/free-regular-svg-icons';
import {useAuth} from "../contexts/AuthContext";
import {formatNotificationTopicLabel, useTeamSubscription} from '../hooks/useTeamSubscription';
import {useApi} from '../hooks/useApi';
import {toast} from 'react-toastify';
import TeamSubscriptionMenu from './TeamSubscriptionMenu';
import Modal from './Modal';

const TeamModal = ({isOpen, onClose, editingTeam}) => {
  const [teamName, setTeamName] = useState('');
  const [teamSubscriptions, setTeamSubscriptions] = useState([]);
  const subscriptionMenuRef = useRef(null);
  const [showSubscriptionMenu, setShowSubscriptionMenu] = useState(false);
  const [subscriptionMenuPosition, setSubscriptionMenuPosition] = useState({x: 0, y: 0});
  const [subscriptionTopics, setSubscriptionTopics] = useState([]);
  const {apiCall} = useApi();
  const {user} = useAuth();
  const {notificationTopics, isLoadingTopics, updateTeamSubscription} = useTeamSubscription();

  const notificationTopicsWithLabels = (notificationTopics || []).map((topic) => ({
    value: topic,
    label: formatNotificationTopicLabel(topic),
  }));

  const arraysEqual = (arrA = [], arrB = []) => {
    if (arrA.length !== arrB.length) {
      return false;
    }
    const sortedA = [...arrA].sort();
    const sortedB = [...arrB].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  };

  const fetchSubscriptions = useCallback(async () => {
    const teamId = editingTeam?._id;
    if (!teamId) return;

    try {
      const response = await apiCall(`/teams/${teamId}/subscriptions`, 'GET');
      setTeamSubscriptions(response || []);
    } catch (error) {
      console.error('Error fetching team subscriptions:', error);
    }
  }, [apiCall, editingTeam?._id]);

  const closeSubscriptionMenu = useCallback(() => {
    setShowSubscriptionMenu(false);
  }, []);

  useEffect(() => {
    if (editingTeam) {
      setTeamName(editingTeam.name);
      fetchSubscriptions();
    } else {
      setTeamName('');
      setTeamSubscriptions([]);
      setSubscriptionTopics([]);
      closeSubscriptionMenu();
    }
  }, [editingTeam, fetchSubscriptions, closeSubscriptionMenu]);

  useEffect(() => {
    if (!isOpen) {
      closeSubscriptionMenu();
    }
  }, [isOpen, closeSubscriptionMenu]);

  const getUserSubscription = useCallback(() => (
    teamSubscriptions.find((subscription) => subscription?.user?._id === user._id) || null
  ), [teamSubscriptions, user?._id]);

  const applyLocalSubscriptionUpdate = (topics) => {
    setTeamSubscriptions((prevSubscriptions = []) => {
      const remaining = prevSubscriptions.filter((subscription) => subscription?.user?._id !== user._id);

      if (!topics.length) {
        return remaining;
      }

      const existing = prevSubscriptions.find((subscription) => subscription?.user?._id === user._id);
      const userInfo = existing?.user || {
        _id: user._id,
        name: user.name,
        email: user.email,
      };

      const updatedSubscription = {
        ...existing,
        user: userInfo,
        topics,
      };

      return [...remaining, updatedSubscription];
    });
  };

  const openSubscriptionMenu = (event) => {
    if (!editingTeam) {
      return;
    }

    event.stopPropagation();
    if (event.type === 'click') {
      event.preventDefault();
    }

    if (showSubscriptionMenu) {
      closeSubscriptionMenu();
      return;
    }

    const subscription = getUserSubscription() || {topics: []};
    const xPosition = event.clientX + window.scrollX;
    const yPosition = event.clientY + window.scrollY;

    setSubscriptionTopics(subscription.topics || []);
    setSubscriptionMenuPosition({x: xPosition, y: yPosition});
    setShowSubscriptionMenu(true);
  };

  const handleSubscriptionTopicToggle = async (topic, checked) => {
    if (!editingTeam) {
      return;
    }

    const previousTopics = subscriptionTopics;
    const updatedTopics = checked
      ? Array.from(new Set([...subscriptionTopics, topic]))
      : subscriptionTopics.filter((value) => value !== topic);

    setSubscriptionTopics(updatedTopics);

    try {
      await updateTeamSubscription(editingTeam._id, updatedTopics);
      applyLocalSubscriptionUpdate(updatedTopics);
      try {
        await fetchSubscriptions();
      } catch (refreshError) {
        console.error('Failed to refresh team subscriptions:', refreshError);
      }
    } catch (error) {
      console.error('Failed to update team notification preferences:', error);
      toast.error('Failed to update notification preferences.');
      setSubscriptionTopics(previousTopics);
    }
  };

  useEffect(() => {
    if (!showSubscriptionMenu) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeSubscriptionMenu();
      }
    };

    const handleMouseDown = (event) => {
      if (subscriptionMenuRef.current && !subscriptionMenuRef.current.contains(event.target)) {
        closeSubscriptionMenu();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [showSubscriptionMenu, closeSubscriptionMenu]);

  useEffect(() => {
    if (showSubscriptionMenu && subscriptionMenuRef.current) {
      const menuWidth = subscriptionMenuRef.current.offsetWidth;
      const menuHeight = subscriptionMenuRef.current.offsetHeight;
      let adjustedX = subscriptionMenuPosition.x;
      let adjustedY = subscriptionMenuPosition.y;

      if (adjustedX - window.scrollX + menuWidth > window.innerWidth) {
        adjustedX = Math.max(window.scrollX, adjustedX - menuWidth);
      }

      if (adjustedY - window.scrollY + menuHeight > window.innerHeight) {
        adjustedY = Math.max(window.scrollY, adjustedY - menuHeight);
      }

      if (adjustedX !== subscriptionMenuPosition.x || adjustedY !== subscriptionMenuPosition.y) {
        setSubscriptionMenuPosition({x: adjustedX, y: adjustedY});
      }
    }
  }, [showSubscriptionMenu, subscriptionMenuPosition]);

  useEffect(() => {
    if (!showSubscriptionMenu) {
      return;
    }

    const subscription = getUserSubscription() || {topics: []};
    const topics = subscription.topics || [];

    if (!arraysEqual(topics, subscriptionTopics)) {
      setSubscriptionTopics(topics);
    }
  }, [teamSubscriptions, showSubscriptionMenu, getUserSubscription, subscriptionTopics]);
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

  const userSubscription = getUserSubscription();
  const isSubscribed = (userSubscription?.topics || []).length > 0;

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
            <h3>Notifications</h3>
            <button
              type="button"
              className="subscribe-button"
              onClick={openSubscriptionMenu}
            >
              <FontAwesomeIcon icon={isSubscribed ? faSolidBell : faRegularBell} style={{marginRight: '5px'}}/>
              Manage notifications
            </button>
            {teamSubscriptions.length === 0 ? (
              <div>No watchers yet.</div>
            ) : (
              teamSubscriptions.map((subscription) => (
                <div key={subscription?.user?._id || subscription?.user?.id}>
                  <span>{subscription?.user?.name || 'Unknown user'}</span>
                  {subscription?.topics?.length > 0 && (
                    <span className="subscriber-topics"> — {subscription.topics.map((topic) => formatNotificationTopicLabel(topic)).join(', ')}</span>
                  )}
                </div>
              ))
            )}
            <TeamSubscriptionMenu
              contextMenuRef={subscriptionMenuRef}
              isOpen={showSubscriptionMenu}
              position={subscriptionMenuPosition}
              onClose={closeSubscriptionMenu}
              topics={notificationTopicsWithLabels}
              selectedTopics={subscriptionTopics}
              onToggleTopic={handleSubscriptionTopicToggle}
              isLoading={isLoadingTopics}
            />
          </div>
        )}
    </Modal>
  );
};

export default TeamModal;
