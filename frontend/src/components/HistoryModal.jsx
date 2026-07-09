import React, {useCallback, useMemo} from 'react';
import Modal from './Modal';
import './HistoryModal.css';
import HistoryList from './HistoryList';
import {usePaginatedHistory} from '../hooks/usePaginatedHistory';

const HistoryModal = ({isOpen, onClose, endpoint, title, showDate = false, memberLookup}) => {
  const {history, listRef, handleScroll} = usePaginatedHistory(isOpen, endpoint);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="day-history-modal">
        <div className="close-button" onClick={onClose}>&times;</div>
        <h3>History for {title} ({history.length} {history.length === 1 ? 'item' : 'items'})</h3>
        <HistoryList
          history={history}
          showDate={showDate}
          memberLookup={memberLookup}
          ref={listRef}
          onScroll={handleScroll}
        />
      </div>
    </Modal>
  );
};

export const DayHistoryModal = ({isOpen, onClose, teamId, memberId, date}) => (
  <HistoryModal
    isOpen={isOpen}
    onClose={onClose}
    title={date}
    endpoint={`/teams/${teamId}/members/${memberId}/days/${date}/history`}
  />
);

export const MemberHistoryModal = ({isOpen, onClose, teamId, memberId, memberName}) => (
  <HistoryModal
    isOpen={isOpen}
    onClose={onClose}
    title={memberName}
    showDate
    endpoint={`/teams/${teamId}/members/${memberId}/history`}
  />
);

export const TeamHistoryModal = ({isOpen, onClose, teamId, teamName, teamMembers = []}) => {
  const memberMap = useMemo(() => {
    const map = {};
    teamMembers.forEach((member) => {
      map[member.uid] = member.name;
    });
    return map;
  }, [teamMembers]);

  const memberLookup = useCallback((uid) => memberMap[uid], [memberMap]);

  return (
    <HistoryModal
      isOpen={isOpen}
      onClose={onClose}
      title={teamName}
      showDate
      memberLookup={memberLookup}
      endpoint={teamId ? `/teams/${teamId}/history` : null}
    />
  );
};

export default HistoryModal;
