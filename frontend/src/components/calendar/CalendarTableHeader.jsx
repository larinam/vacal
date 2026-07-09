import React from 'react';
import {isToday, isWeekend, isYesterday} from 'date-fns';
import {formatDate} from '../../utils/calendar';

// <colgroup> + <thead> for the calendar table, rendered as a fragment so both
// land as direct children of <table>.
const CalendarTableHeader = ({daysHeader, weekSpans, displayMonth, onAddTeamClick}) => (
  <>
    <colgroup>
      <col className="name-col"/>
      {/* This col is for the non-date column */}
      {daysHeader.map(({date}) => (
        <col key={formatDate(date)} className={isWeekend(date) ? 'weekend-column' : ''}/>
      ))}
    </colgroup>
    <thead>
    <tr>
      <th></th>
      {Array.from(weekSpans).map(([week, span]) => (
        <th key={week} colSpan={span} className="week-number-header">
          {span < 2 ? week : `Week ${week}`}
        </th>
      ))}
    </tr>
    <tr>
      <th>
        Team<span className="add-icon" onClick={onAddTeamClick} title="Add team">➕ </span>
        / Member
      </th>
      {daysHeader.map(({day, weekday, date}) => {
        const isOutOfMonth = date.getMonth() !== displayMonth.getMonth();
        const isWeekendDay = isWeekend(date);
        return (
          <th
            key={formatDate(date)}
            className={`${
              isToday(date)
                ? 'current-day-number'
                : isOutOfMonth
                  ? 'out-of-month-day-number' // Assign a different class for out-of-month days
                  : 'day-number-header'
            } ${isWeekendDay ? 'weekend-day-header' : ''} ${isYesterday(date) ? 'yesterday' : ''}`}
          >
            <div className="day-header">
              <span className="day-header-name">{weekday}</span>
              <span className="day-header-number">{day}</span>
            </div>
          </th>
        );
      })}
    </tr>
    </thead>
  </>
);

export default CalendarTableHeader;
