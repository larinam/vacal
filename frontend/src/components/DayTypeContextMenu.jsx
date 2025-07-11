import React, {useEffect, useState} from 'react';
import './DayTypeContextMenu.css';
import {useApi} from '../hooks/useApi';
import {format, isWeekend} from 'date-fns';
import {toast} from 'react-toastify';
import DayTypeCheckbox from './DayTypeCheckbox';

const DayTypeContextMenu = ({
                              contextMenuRef,
                              isOpen,
                              position,
                              onClose,
                              dayTypes,
                              selectedDayInfo,
                              updateTeamData,
                              updateLocalTeamData,
                              teamData,
                            }) => {
  const [selectedDayTypes, setSelectedDayTypes] = useState([]);
  const [comment, setComment] = useState('');
  const [initialComment, setInitialComment] = useState('');
  const {apiCall} = useApi();

  useEffect(() => {
    if (isOpen) {
      const dayTypeIds = selectedDayInfo.existingDayTypes.map((type) => type._id);
      setSelectedDayTypes(dayTypeIds);
      const existingComment = selectedDayInfo.existingComment || '';
      setComment(existingComment);
      setInitialComment(existingComment);
    } else {
      setSelectedDayTypes([]);
      setComment('');
      setInitialComment('');
    }
  }, [isOpen, selectedDayInfo]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCheckboxChange = async (typeObj, checked) => {
    const value = typeObj._id;
    const updatedDayTypes = checked
      ? [...selectedDayTypes, value]
      : selectedDayTypes.filter((type) => type !== value);

    if (typeObj.identifier === 'vacation') {
      const team = teamData.find(t => t._id === selectedDayInfo.teamId);
      const member = team.team_members.find(m => m.uid === selectedDayInfo.memberId);
      const totalVacation = Object.values(member.vacation_used_days_by_year || {}).reduce((a,b)=>a+b,0) +
        Object.values(member.vacation_planned_days_by_year || {}).reduce((a,b)=>a+b,0);
      let existingVacationCount = 0;
      selectedDayInfo.dateRange.forEach((d) => {
        const ds = format(d, 'yyyy-MM-dd');
        const entry = member.days[ds];
        if (entry && entry.day_types.some(dt => dt.identifier === 'vacation')) {
          existingVacationCount += 1;
        }
      });
      const updatedVacationCount = updatedDayTypes.includes(value) ? selectedDayInfo.dateRange.length : 0;
      const newTotal = totalVacation - existingVacationCount + updatedVacationCount;
      if (member.vacation_available_days != null && newTotal > member.vacation_available_days) {
        const confirmText =
          'Not enough vacation days available. Would you like to proceed anyway?';
        if (!window.confirm(confirmText)) {
          return;
        }
      }
    }

    setSelectedDayTypes(updatedDayTypes);
    await updateDayData(updatedDayTypes, comment);
    onClose();
  };

  const handleCommentChange = (e) => setComment(e.target.value);

  const handleCommentBlur = async () => {
    if (comment !== initialComment) {
      await updateDayData(selectedDayTypes, comment);
    }
  };

  const updateDayData = async (dayTypes, comment) => {
    const dayTypeData = {};

    if (selectedDayInfo.dateRange && selectedDayInfo.dateRange.length > 0) {
      selectedDayInfo.dateRange.forEach((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        dayTypeData[dateStr] = {day_types: dayTypes, comment};
        updateLocalTeamData(selectedDayInfo.teamId, selectedDayInfo.memberId, dateStr, dayTypes, comment);
      });
    } else {
      console.error('No valid date range provided.');
      return;
    }

    const url = `/teams/${selectedDayInfo.teamId}/members/${selectedDayInfo.memberId}/days`;

    try {
      await apiCall(url, 'PUT', dayTypeData);
      updateTeamData();
    } catch (error) {
      console.error('Error updating day types:', error);
      toast.error(error?.data?.detail);
    }
  };

  if (!isOpen) return null;

  const contextMenuStyle = {
    position: 'absolute',
    top: `${position.y}px`,
    left: `${position.x}px`,
  };

  let displayDate = '';

  if (selectedDayInfo.dateRange && selectedDayInfo.dateRange.length > 0) {
    if (selectedDayInfo.dateRange.length === 1) {
      // If there's only one day in the range
      const date = selectedDayInfo.dateRange[0];
      displayDate = new Intl.DateTimeFormat(navigator.language, {weekday: 'long'}).format(date) +
        ', ' + format(date, 'yyyy-MM-dd');
    } else {
      // If there are multiple days, show the range
      const startDate = selectedDayInfo.dateRange[0];
      const endDate = selectedDayInfo.dateRange[selectedDayInfo.dateRange.length - 1];
      displayDate = `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')} (${selectedDayInfo.dateRange.length} days)`;
    }
  }

  return (
    <div className="context-menu" style={contextMenuStyle} ref={contextMenuRef}>
      {selectedDayInfo && <div className="display-date-info">{displayDate}</div>}
      <div className="close-button" onClick={onClose}>
        &times;
      </div>

      {dayTypes.map((type) => {
        if (type.identifier === 'vacation') {
          return (
            <DayTypeCheckbox
              key={type._id}
              type={type}
              selected={selectedDayTypes.includes(type._id)}
              onChange={handleCheckboxChange}
            />
          );
        }
        return null;
      })}

      {selectedDayInfo && (
        <div className="member-info">
          {selectedDayInfo.memberName}
          <br/>
        </div>
      )}

      <textarea
        className="comment-input"
        placeholder="Add a comment"
        value={comment}
        onChange={handleCommentChange}
        onBlur={handleCommentBlur}
      />

      {dayTypes
        .filter((type) => type.identifier !== 'vacation' && type.identifier !== 'birthday')
        .map((type) => {
          // If it's an override type and the condition is not met, return null immediately.
          // For override type, check if it's a weekend or holiday
          // Only check the first date in the range for simplicity
          if (type.identifier === 'override' && 
              selectedDayInfo.dateRange && 
              selectedDayInfo.dateRange.length > 0 && 
              !(isWeekend(selectedDayInfo.dateRange[0]) || selectedDayInfo.isHolidayDay)) {
            return null;
          }

          return (
            <DayTypeCheckbox
              key={type._id}
              type={type}
              selected={selectedDayTypes.includes(type._id)}
              onChange={handleCheckboxChange}
            />
          );
        })}

    </div>
  );
};

export default DayTypeContextMenu;
