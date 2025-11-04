import React, {useMemo} from 'react';
import {format} from 'date-fns';

const HistoryList = React.forwardRef(({history, showDate = false, onScroll}, ref) => {
  const sortedHistory = useMemo(() => {
    if (!Array.isArray(history)) {
      return [];
    }
    return [...history].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [history]);

  const timelineElements = useMemo(() => {
    if (sortedHistory.length === 0) {
      return [];
    }

    const elements = [];

    sortedHistory.forEach((entry, index) => {
      const entryKey = entry._id || entry.id || `history-${index}`;

      elements.push({
        type: 'state',
        key: `state-${entryKey}`,
        label: showDate && entry.date ? `State as of ${entry.date}` : 'State',
        dayTypes: Array.isArray(entry.new_day_types) ? entry.new_day_types : [],
        comment: entry.new_comment,
        isLatest: index === 0,
      });

      elements.push({
        type: 'connector',
        key: `connector-${entryKey}`,
        entry,
      });
    });

    const oldestEntry = sortedHistory[sortedHistory.length - 1];

    elements.push({
      type: 'state',
      key: 'state-beginning',
      label: 'Beginning',
      dayTypes:
        oldestEntry && Array.isArray(oldestEntry.old_day_types)
          ? oldestEntry.old_day_types
          : [],
      comment: oldestEntry ? oldestEntry.old_comment : '',
      isBeginning: true,
    });

    return elements;
  }, [sortedHistory, showDate]);

  return (
    <div className="day-history-list" ref={ref} onScroll={onScroll}>
      {history.length === 0 ? (
        <p>No history found.</p>
      ) : (
        <div className="history-timeline">
          {timelineElements.map((element) => {
            if (element.type === 'state') {
              const dayTypes = element.dayTypes || [];
              return (
                <div
                  key={element.key}
                  className={`timeline-state${
                    element.isLatest ? ' timeline-state-latest' : ''
                  }${element.isBeginning ? ' timeline-state-beginning' : ''}`}
                >
                  <div className="timeline-state-header">
                    <span>{element.label}</span>
                    {element.isLatest && <span className="timeline-latest-badge">Latest</span>}
                  </div>
                  <div className="timeline-state-section">
                    <span className="timeline-section-title">Day types</span>
                    <div className="timeline-day-types">
                      {dayTypes.length > 0 ? (
                        dayTypes.map((dt) => (
                          <span
                            key={dt._id || dt.id || dt.name}
                            className="day-type-tag"
                            style={dt?.color ? {backgroundColor: dt.color} : undefined}
                          >
                            {dt?.name || 'Unnamed'}
                          </span>
                        ))
                      ) : (
                        <span className="timeline-empty">None</span>
                      )}
                    </div>
                  </div>
                  <div className="timeline-state-section">
                    <span className="timeline-section-title">Comment</span>
                    {element.comment ? (
                      <p className="timeline-comment">{element.comment}</p>
                    ) : (
                      <span className="timeline-empty">No comment</span>
                    )}
                  </div>
                </div>
              );
            }

            const {entry} = element;
            const formattedTimestamp = entry?.timestamp
              ? format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm')
              : 'Unknown time';
            const userName = entry?.user
              ? entry.user.name || entry.user.username || 'Unknown'
              : 'Unknown';
            const actionLabel = entry?.action
              ? entry.action.charAt(0).toUpperCase() + entry.action.slice(1)
              : 'Unknown';

            return (
              <div key={element.key} className="timeline-connector">
                <div className="timeline-arrow" aria-hidden="true">
                  ↑
                </div>
                <div className="timeline-meta">
                  <div>
                    <span className="timeline-meta-label">Changed:</span> {formattedTimestamp}
                  </div>
                  <div>
                    <span className="timeline-meta-label">Author:</span> {userName}
                  </div>
                  {entry?.date && (
                    <div>
                      <span className="timeline-meta-label">Target date:</span>{' '}
                      {entry.date}
                    </div>
                  )}
                  <div className="timeline-action">
                    <span className="timeline-meta-label">Action:</span>
                    <span className={`action-tag action-${entry?.action || 'unknown'}`}>
                      {actionLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default HistoryList;
