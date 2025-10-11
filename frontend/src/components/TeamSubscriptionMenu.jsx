import React from 'react';
import './TeamSubscriptionMenu.css';

const TeamSubscriptionMenu = ({
  contextMenuRef,
  isOpen,
  position,
  onClose,
  topics,
  selectedTopics,
  onToggleTopic,
  isLoading,
}) => {
  if (!isOpen) {
    return null;
  }

  const style = {
    position: 'absolute',
    top: `${position.y}px`,
    left: `${position.x}px`,
  };

  const displayTopics = topics.map((topic) =>
    typeof topic === 'string' ? {value: topic, label: topic} : topic,
  );

  return (
    <div className="context-menu team-subscription-menu" style={style} ref={contextMenuRef}>
      <div className="close-button" onClick={onClose}>&times;</div>
      <div className="menu-title">Team notifications</div>
      {isLoading && <div className="menu-status">Loading…</div>}
      {!isLoading && displayTopics.length === 0 && (
        <div className="menu-status">No notification options available.</div>
      )}
      {!isLoading && displayTopics.map(({value, label}) => {
        const isChecked = selectedTopics.includes(value);
        return (
          <label key={value} className="menu-option">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(event) => onToggleTopic(value, event.target.checked)}
            />
            <span>{label}</span>
          </label>
        );
      })}
      <div className="menu-hint">Unselect all options to stop watching this team.</div>
    </div>
  );
};

export default TeamSubscriptionMenu;
