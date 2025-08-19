import React from 'react';
import Modal from './Modal';
import './DayHistoryModal.css';
import HistoryList from './HistoryList';
import {usePaginatedHistory} from '../hooks/usePaginatedHistory';

const MemberHistoryModal = ({isOpen, onClose, teamId, memberId, memberName}) => {
  const endpoint = `/teams/${teamId}/members/${memberId}/history`;
  const {history, listRef, handleScroll} = usePaginatedHistory(isOpen, endpoint);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="day-history-modal">
        <div className="close-button" onClick={onClose}>&times;</div>
        <h3>History for {memberName} ({history.length} {history.length === 1 ? 'item' : 'items'})</h3>
        <HistoryList
          history={history}
          showDate
          ref={listRef}
          onScroll={handleScroll}
        />
      </div>
    </Modal>
  );
};

export default MemberHistoryModal;
