import {useCallback, useEffect, useState} from 'react';
import {useApi} from './useApi';

const TOPIC_LABELS = {
  recent_absences: 'Recent absences',
  absence_starts: 'Absence starts',
  upcoming_absences: 'Upcoming absences',
  birthdays: 'Birthdays',
};

let cachedNotificationTopics = null;

export const formatNotificationTopicLabel = (topic) => {
  if (!topic) return '';
  if (TOPIC_LABELS[topic]) {
    return TOPIC_LABELS[topic];
  }

  return topic
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const useTeamSubscription = () => {
  const {apiCall} = useApi();
  const [notificationTopics, setNotificationTopics] = useState(cachedNotificationTopics ?? []);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

  const fetchNotificationTopics = useCallback(async () => {
    if (cachedNotificationTopics) {
      setNotificationTopics(cachedNotificationTopics);
      return cachedNotificationTopics;
    }

    setIsLoadingTopics(true);
    try {
      const topics = await apiCall('/teams/notification-topics', 'GET');
      cachedNotificationTopics = topics;
      setNotificationTopics(topics);
      return topics;
    } finally {
      setIsLoadingTopics(false);
    }
  }, [apiCall]);

  useEffect(() => {
    if (!cachedNotificationTopics) {
      fetchNotificationTopics().catch((error) => {
        console.error('Failed to load notification topics', error);
      });
    }
  }, [fetchNotificationTopics]);

  const updateTeamSubscription = useCallback(async (teamId, topics) => {
    if (!topics || topics.length === 0) {
      await apiCall(`/teams/${teamId}/unsubscribe`, 'POST');
      return;
    }

    await apiCall(`/teams/${teamId}/subscribe`, 'POST', {
      notification_topics: topics,
    });
  }, [apiCall]);

  return {
    notificationTopics,
    isLoadingTopics,
    fetchNotificationTopics,
    updateTeamSubscription,
  };
};
