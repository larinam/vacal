import React, {useEffect, useState} from 'react';
import Modal from './Modal';
import {useApi} from '../hooks/useApi';
import './DayHistoryModal.css';
import {format} from 'date-fns';

const DayHistoryModal = ({isOpen, onClose, teamId, memberId, date}) => {
  const {apiCall} = useApi();
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
              {format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm')} - {entry.user ? (entry.user.name || entry.user.username) : 'Unknown'}
              <span
                className={`action-tag action-${entry.action}`}>{entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}</span>
            </div>
            {(entry.old_day_types.length > 0 || entry.old_comment) && (
              <div>
                Old:{' '}
                {entry.old_day_types.map((dt) => (
                  <span key={dt._id} className="day-type-tag">{dt.name}</span>
                ))}
                {entry.old_comment && <span>{entry.old_comment}</span>}
              </div>
            )}
            {(entry.new_day_types.length > 0 || entry.new_comment) && (
              <div>
                New:{' '}
                {entry.new_day_types.map((dt) => (
                  <span key={dt._id} className="day-type-tag">{dt.name}</span>
                ))}
                {entry.new_comment && <span>{entry.new_comment}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default DayHistoryModal;

