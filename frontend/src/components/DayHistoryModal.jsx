import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { useApi } from '../hooks/useApi';
import './DayHistoryModal.css';

const DayHistoryModal = ({ isOpen, onClose, teamId, memberId, date }) => {
  const { apiCall } = useApi();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!isOpen) return;
      try {
        const result = await apiCall(`/teams/${teamId}/members/${memberId}/days/${date}/history`, 'GET');
        setHistory(result);
      } catch (error) {
        console.error('Error fetching day history:', error);
      }
    };
    fetchHistory();
  }, [isOpen, teamId, memberId, date]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3>History for {date} ({history.length} {history.length === 1 ? 'item' : 'items'})</h3>
      <div className="day-history-list">
        {history.length === 0 && <p>No history found.</p>}
        {history.map((entry) => (
          <div key={entry._id || entry.id} className="day-history-entry">
            <div>
              {new Date(entry.timestamp).toLocaleString(undefined, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZoneName: 'short'
              })}
              {' '} - {entry.user ? (entry.user.name || entry.user.username) : 'Unknown'}
            </div>
            <div>Action: {entry.action}</div>
            {(entry.old_day_types.length > 0 || entry.old_comment) && (
              <div>
                Old: {entry.old_day_types.map((dt) => dt.name).join(', ')} {entry.old_comment}
              </div>
            )}
            {(entry.new_day_types.length > 0 || entry.new_comment) && (
              <div>
                New: {entry.new_day_types.map((dt) => dt.name).join(', ')} {entry.new_comment}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default DayHistoryModal;

