import React, {useEffect, useState} from 'react';
import Modal from './Modal';
import {useApi} from '../hooks/useApi';
import './DayHistoryModal.css';
import HistoryList from './HistoryList';

const MemberHistoryModal = ({isOpen, onClose, teamId, memberId, memberName}) => {
  const {apiCall} = useApi();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!isOpen) return;
      try {
        const result = await apiCall(`/teams/${teamId}/members/${memberId}/history`, 'GET');
        setHistory(result);
      } catch (error) {
        console.error('Error fetching member history:', error);
      }
    };
    fetchHistory();
  }, [isOpen, teamId, memberId]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="day-history-modal">
        <div className="close-button" onClick={onClose}>&times;</div>
        <h3>History for {memberName} ({history.length} {history.length === 1 ? 'item' : 'items'})</h3>
        <HistoryList history={history} showDate />
      </div>
    </Modal>
  );
};

export default MemberHistoryModal;
