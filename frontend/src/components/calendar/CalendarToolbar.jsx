import React, {useEffect, useRef} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faSave} from '@fortawesome/free-solid-svg-icons';
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
          aria-label="Filter by team or member name"
        />
        <select
          className="manager-filter"
          value={managerFilterUid}
          onChange={(e) => onManagerFilterChange(e.target.value)}
          title="Filter by manager"
          aria-label="Filter by manager"
        >
          <option value="">All members</option>
          {managerSelectOptions.map((m) => (
            <option key={m.uid} value={m.uid}>{m.label}</option>
          ))}
        </select>
        {/* Always rendered so its width is reserved in the layout even when
            hidden — revealing it on manager select must not shift the centred
            month control. Hidden (not removed) via .scope-toggle--reserved. */}
        <div
          className={`scope-toggle${managerFilterUid ? '' : ' scope-toggle--reserved'}`}
          role="group"
          aria-label="Report scope"
          aria-hidden={managerFilterUid ? undefined : true}
          title="Report scope"
        >
          <button
            type="button"
            className={reportScope === 'direct' ? 'active' : ''}
            aria-pressed={reportScope === 'direct'}
            disabled={!managerFilterUid}
            onClick={() => onReportScopeChange('direct')}
          >
            Direct
          </button>
          <button
            type="button"
            className={reportScope === 'all' ? 'active' : ''}
            aria-pressed={reportScope === 'all'}
            disabled={!managerFilterUid}
            onClick={() => onReportScopeChange('all')}
          >
            All levels
          </button>
        </div>
      </div>
      <MonthSelector
        displayMonth={displayMonth}
        setDisplayMonth={setDisplayMonth}
        todayYear={todayYear}
        todayMonth={todayMonth}
      />
      {/* Reserves space for MainComponent's fixed action icons on the right. */}
      <div className="header-actions-reserve" aria-hidden="true"/>
      {showSaveIcon && <FontAwesomeIcon icon={faSave} className="save-icon"/>}
    </div>
  );
};

export default CalendarToolbar;
