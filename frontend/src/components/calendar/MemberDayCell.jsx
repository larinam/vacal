import React from 'react';
import {isToday, isWeekend, isYesterday} from 'date-fns';
import '../CalendarComponent.css';
import {
  generateGradientStyle,
  getCellTitle,
  getMemberDayEntry,
  isHoliday,
  isSelectableDay,
} from '../../utils/calendar';

// One selectable day cell. Both onMouseUp and onClick stay wired: a plain
// click opens the day menu through the selection path on mouse-up, then the
// click handler re-opens it with the computed isHolidayDay value.
const MemberDayCell = ({teamId, member, date, holidayData, isSelected, onMouseDown, onMouseOver, onMouseUp, onClick}) => {
  const dayEntry = getMemberDayEntry(member, date);
  const dateDayTypes = dayEntry?.day_types || [];
  const isHolidayDay = isHoliday(holidayData, member.country, date);
  const hasComment = dayEntry?.comment && dayEntry.comment.trim().length > 0;

  const cellClassNames = [
    'clickable-cell',
    isHolidayDay ? 'holiday-cell' : '',
    isWeekend(date) ? 'weekend-cell' : '',
    isToday(date) ? 'current-day' : (isYesterday(date) ? 'yesterday' : ''),
    isSelected ? 'selected-range' : '',
  ].filter(Boolean).join(' ');

  return (
    <td
      onMouseDown={() => onMouseDown(teamId, member.uid, date, isSelectableDay(member, date, holidayData))}
      onMouseOver={() => onMouseOver(teamId, member.uid, date, member)}
      onMouseUp={onMouseUp}
      onClick={(e) => onClick(teamId, member.uid, date, isHolidayDay, e)}
      title={getCellTitle(holidayData, member, date)}
      className={cellClassNames}
      style={generateGradientStyle(dateDayTypes)}
    >
      <div className="day-cell-content">
        {hasComment && <span className="comment-icon">*</span>}
      </div>
    </td>
  );
};

export default MemberDayCell;
