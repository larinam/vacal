import React, {useEffect, useRef, useState} from 'react';
import './TeamSubscriptionContextMenu.css';
import {useTeamSubscription} from '../hooks/useTeamSubscription';

const TeamSubscriptionContextMenu = ({
  contextMenuRef,
  isOpen,
  position,
  onClose,
  teamId,
  teamName,
  currentUserId,
  subscribers = [],
  onPreferencesUpdated,
}) => {
  const {
    listNotificationTypes,
    getTeamNotificationPreferences,
    updateTeamNotificationPreferences,
  } = useTeamSubscription();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const cachedPreferencesRef = useRef(new Map());

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (event) => {
      if (contextMenuRef?.current && !contextMenuRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (!isOpen) {
      return undefined;
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, contextMenuRef]);

  useEffect(() => {
    cachedPreferencesRef.current.clear();
    setSelectedTypes([]);
  }, [currentUserId]);

  useEffect(() => {
    if (!isOpen || !teamId) {
      return;
    }

    if (cachedPreferencesRef.current.has(teamId)) {
      setSelectedTypes(cachedPreferencesRef.current.get(teamId) || []);
    } else {
      setSelectedTypes([]);
    }
  }, [isOpen, teamId]);

  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const fetchData = async () => {
      if (!teamId) {
        setAvailableTypes([]);
        setSelectedTypes([]);
        return;
      }

      const hasCachedPreferences = cachedPreferencesRef.current.has(teamId);
      setIsLoading(!hasCachedPreferences);
      setHasError(false);

      try {
        const [types, preferences] = await Promise.all([
          listNotificationTypes(),
          currentUserId ? getTeamNotificationPreferences(teamId) : Promise.resolve([]),
        ]);

        if (isCancelled) {
          return;
        }

        setAvailableTypes(types || []);

        if (!currentUserId) {
          cachedPreferencesRef.current.set(teamId, []);
          setSelectedTypes([]);
          return;
        }

        const userPreference = (preferences || []).find((preference) => {
          const preferenceUserId = preference.user?._id || preference.user?.id;
          return preferenceUserId === currentUserId;
        });
        const normalizedTypes = userPreference ? userPreference.notification_types : [];
        cachedPreferencesRef.current.set(teamId, normalizedTypes);
        setSelectedTypes(normalizedTypes);
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load subscription options:', error);
          setHasError(true);
          if (!cachedPreferencesRef.current.has(teamId)) {
            setAvailableTypes([]);
            setSelectedTypes([]);
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, teamId, currentUserId, listNotificationTypes, getTeamNotificationPreferences]);

  if (!isOpen) {
    return null;
  }

  const style = {
    position: 'absolute',
    top: `${position.y}px`,
    left: `${position.x}px`,
  };

  const handleCheckboxChange = async (event, identifier) => {
    event.stopPropagation();
    if (isProcessing || !teamId) {
      return;
    }

    const previousTypes = [...selectedTypes];
    const nextTypes = event.target.checked
      ? Array.from(new Set([...selectedTypes, identifier]))
      : selectedTypes.filter((type) => type !== identifier);

    const hasChanged =
      nextTypes.length !== previousTypes.length ||
      nextTypes.some((type) => !previousTypes.includes(type));

    if (!hasChanged) {
      return;
    }

    setSelectedTypes(nextTypes);
    cachedPreferencesRef.current.set(teamId, nextTypes);
    setIsProcessing(true);

    try {
      const response = await updateTeamNotificationPreferences(teamId, nextTypes);
      const normalizedTypes = response?.notification_types ?? nextTypes;
      cachedPreferencesRef.current.set(teamId, normalizedTypes);
      setSelectedTypes(normalizedTypes);
      if (onPreferencesUpdated) {
        await onPreferencesUpdated();
      }
    } catch (error) {
      console.error('Failed to update subscription preferences:', error);
      setSelectedTypes(previousTypes);
      cachedPreferencesRef.current.set(teamId, previousTypes);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasCachedPreferences = teamId ? cachedPreferencesRef.current.has(teamId) : false;
  const hasOptions = availableTypes.length > 0;
  const shouldShowLoadingState = isLoading && !hasCachedPreferences;
  const shouldShowErrorState = hasError && !hasCachedPreferences;

  return (
    <div className="team-subscription-menu" style={style} ref={contextMenuRef}>
      <div className="team-subscription-menu__header">
        <span className="team-subscription-menu__title">{teamName || 'Team subscription'}</span>
        <button
          type="button"
          className="team-subscription-menu__close"
          onClick={onClose}
          aria-label="Close subscription menu"
        >
          &times;
        </button>
      </div>
      {shouldShowLoadingState ? (
        <div className="team-subscription-menu__status">Loading subscription options…</div>
      ) : shouldShowErrorState ? (
        <div className="team-subscription-menu__status team-subscription-menu__status--error">
          Unable to load subscription options.
        </div>
      ) : (
        <>
          {hasOptions ? (
            <div className="team-subscription-menu__options">
              {availableTypes.map((type) => (
                <label key={type.identifier} className="team-subscription-menu__option">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type.identifier)}
                    onChange={(event) => handleCheckboxChange(event, type.identifier)}
                    disabled={isProcessing}
                  />
                  <span className="team-subscription-menu__option-content">
                    <span className="team-subscription-menu__option-label">{type.label}</span>
                    {type.description && (
                      <span className="team-subscription-menu__option-description">{type.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="team-subscription-menu__status">No subscription options available.</div>
          )}
          {hasError && hasCachedPreferences && (
            <div className="team-subscription-menu__status team-subscription-menu__status--error">
              Showing saved preferences. Failed to refresh latest settings.
            </div>
          )}
        </>
      )}
      <div className="team-subscription-menu__subscribers">
        <span className="team-subscription-menu__subscribers-label">Watchers</span>
        {subscribers.length === 0 ? (
          <div className="team-subscription-menu__subscribers-empty">No watchers yet</div>
        ) : (
          <ul className="team-subscription-menu__subscribers-list">
            {subscribers.map((subscriber) => {
              const subscriberId = subscriber._id || subscriber.id || subscriber.email || 'unknown';
              return (
                <li key={subscriberId} className="team-subscription-menu__subscriber">
                  {subscriber.name || subscriber.email || 'Unknown user'}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TeamSubscriptionContextMenu;
