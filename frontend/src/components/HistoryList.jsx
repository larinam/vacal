import React from 'react';
import {format} from 'date-fns';

const HistoryList = ({history, showDate = false}) => (
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
            {format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm')}
            {showDate && ` [${entry.date}]`} - {entry.user ? (entry.user.name || entry.user.username) : 'Unknown'}
            <span className={`action-tag action-${entry.action}`}>
              {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
            </span>
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
                          <span
                            key={dt._id || dt.id}
                            className="day-type-tag"
                            style={{backgroundColor: dt.color}}
                          >
                            {dt.name}
                          </span>
                        ))}
                      </td>
                      <td>
                        {entry.new_day_types.map((dt) => (
                          <span
                            key={dt._id || dt.id}
                            className="day-type-tag"
                            style={{backgroundColor: dt.color}}
                          >
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
);

export default HistoryList;
