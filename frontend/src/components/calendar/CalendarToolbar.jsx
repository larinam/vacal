import React, {useEffect, useRef} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faSave} from '@fortawesome/free-solid-svg-icons';
import '../CalendarComponent.css';
import MonthSelector from '../MonthSelector';

// Sticky header: text filter (autofocused on mount), manager filter with
// report-scope toggle, month navigation, and the saved-preferences flash icon.
const CalendarToolbar = ({
                           filterInput,
                           onFilterInputChange,
                           managerFilterUid,
                           onManagerFilterChange,
                           managerSelectOptions,
                           reportScope,
                           onReportScopeChange,
                           displayMonth,
                           setDisplayMonth,
                           todayYear,
                           todayMonth,
                           showSaveIcon,
                         }) => {
  const filterInputRef = useRef(null);

  useEffect(() => {
    if (filterInputRef.current) {
      filterInputRef.current.focus();
    }
  }, []);

  return (
    <div className="stickyHeader">
      <div className="filter-wrapper">
        <input
          type="search"
          ref={filterInputRef}
          value={filterInput}
          onChange={(e) => onFilterInputChange(e.target.value)}
          placeholder="Filter by team or member name"
        />
        <select
          className="manager-filter"
          value={managerFilterUid}
          onChange={(e) => onManagerFilterChange(e.target.value)}
          title="Filter by manager"
        >
          <option value="">All members</option>
          {managerSelectOptions.map((m) => (
            <option key={m.uid} value={m.uid}>{m.label}</option>
          ))}
        </select>
        {managerFilterUid && (
          <div className="scope-toggle" role="group" aria-label="Report scope">
            <button
              type="button"
              className={reportScope === 'direct' ? 'active' : ''}
              onClick={() => onReportScopeChange('direct')}
            >
              Direct reports
            </button>
            <button
              type="button"
              className={reportScope === 'all' ? 'active' : ''}
              onClick={() => onReportScopeChange('all')}
            >
              Entire hierarchy
            </button>
          </div>
        )}
      </div>
      <MonthSelector
        displayMonth={displayMonth}
        setDisplayMonth={setDisplayMonth}
        todayYear={todayYear}
        todayMonth={todayMonth}
      />
      {showSaveIcon && <FontAwesomeIcon icon={faSave} className="save-icon"/>}
    </div>
  );
};

export default CalendarToolbar;
