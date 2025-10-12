import React, {useEffect, useState} from 'react';
import './TeamSubscriptionContextMenu.css';

const TeamSubscriptionContextMenu = ({
  contextMenuRef,
  isOpen,
  position,
  onClose,
  teamName,
  isSubscribed,
  onToggle,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

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

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, contextMenuRef]);

  if (!isOpen) {
    return null;
  }

  const style = {
    position: 'absolute',
    top: `${position.y}px`,
    left: `${position.x}px`,
  };

  const handleCheckboxChange = async (event) => {
    event.stopPropagation();
    if (isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      await onToggle();
    } finally {
      setIsProcessing(false);
    }
  };

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
      <label className="team-subscription-menu__option">
        <input
          type="checkbox"
          checked={isSubscribed}
          onChange={handleCheckboxChange}
          disabled={isProcessing}
        />
        <span>Watch team</span>
      </label>
    </div>
  );
};

export default TeamSubscriptionContextMenu;
