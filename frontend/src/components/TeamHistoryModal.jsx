import React, {useCallback, useMemo} from 'react';
import Modal from './Modal';
import './DayHistoryModal.css';
import HistoryList from './HistoryList';
import {usePaginatedHistory} from '../hooks/usePaginatedHistory';

const TeamHistoryModal = ({isOpen, onClose, teamId, teamName, teamMembers = []}) => {
  const endpoint = teamId ? `/teams/${teamId}/history` : null;
  const {history, listRef, handleScroll} = usePaginatedHistory(isOpen, endpoint);

  const memberMap = useMemo(() => {
    const map = {};
    teamMembers.forEach((member) => {
      map[member.uid] = member.name;
    });
    return map;
  }, [teamMembers]);

  const memberLookup = useCallback((uid) => memberMap[uid], [memberMap]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="day-history-modal">
        <div className="close-button" onClick={onClose}>&times;</div>
        <h3>History for {teamName} ({history.length} {history.length === 1 ? 'item' : 'items'})</h3>
        <HistoryList
          history={history}
          showDate
          memberLookup={memberLookup}
          ref={listRef}
          onScroll={handleScroll}
        />
      </div>
    </Modal>
  );
};

export default TeamHistoryModal;
