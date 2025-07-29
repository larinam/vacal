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
        {history.map((entry) => {
          const dayTypesEqual = () => {
            if (entry.old_day_types.length !== entry.new_day_types.length) return false;
            const oldIds = entry.old_day_types.map((dt) => dt._id || dt.id).sort();
            const newIds = entry.new_day_types.map((dt) => dt._id || dt.id).sort();
            return oldIds.every((id, idx) => id === newIds[idx]);
          };

          const showDayTypesRow =
            (entry.old_day_types.length > 0 || entry.new_day_types.length > 0) &&
            !dayTypesEqual();

          const showCommentsRow =
            ((entry.old_comment && entry.old_comment !== '') ||
              (entry.new_comment && entry.new_comment !== '')) &&
            entry.old_comment !== entry.new_comment;

          const showDiff = showDayTypesRow || showCommentsRow;

          return (
            <div key={entry._id || entry.id} className="day-history-entry">
              <div>
                {format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm')} - {entry.user ? (entry.user.name || entry.user.username) : 'Unknown'}
                <span
                  className={`action-tag action-${entry.action}`}>{entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}</span>
              </div>
              {showDiff && (
                <div className="diff-container">
                  <span className="diff-arrow">&rarr;</span>
                  <table className="diff-table">
                    <tbody>
                  {showDayTypesRow && (
                    <tr>
                      <td>
                        {entry.old_day_types.map((dt) => (
                          <span key={dt._id} className="day-type-tag" style={{backgroundColor: dt.color}}>
                            {dt.name}
                          </span>
                        ))}
                      </td>
                      <td>
                        {entry.new_day_types.map((dt) => (
                          <span key={dt._id} className="day-type-tag" style={{backgroundColor: dt.color}}>
                            {dt.name}
                          </span>
                        ))}
                      </td>
                    </tr>
                  )}
                  {showCommentsRow && (
                    <tr>
                      <td>{entry.old_comment}</td>
                      <td>{entry.new_comment}</td>
                    </tr>
                  )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default DayHistoryModal;

