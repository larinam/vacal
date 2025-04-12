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

  const handleCheckboxChange = async (value, checked) => {
    const updatedDayTypes = checked
      ? [...selectedDayTypes, value]
      : selectedDayTypes.filter((type) => type !== value);

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
    const dateStr = format(selectedDayInfo.date, 'yyyy-MM-dd');
    const dayTypeData = {[dateStr]: {day_types: dayTypes, comment}};

    const url = `/teams/${selectedDayInfo.teamId}/members/${selectedDayInfo.memberId}/days`;
    try {
      await apiCall(url, 'PUT', dayTypeData);
      updateTeamData();
    } catch (error) {
      console.error('Error updating day types:', error);
      toast.error(error?.data?.detail);
    }

    updateLocalTeamData(
      selectedDayInfo.teamId,
      selectedDayInfo.memberId,
      dateStr,
      dayTypes,
      comment
    );
  };

  if (!isOpen) return null;

  const contextMenuStyle = {
    position: 'absolute',
    top: `${position.y}px`,
    left: `${position.x}px`,
  };

  const displayDate = selectedDayInfo.date
    ? new Intl.DateTimeFormat(navigator.language, {weekday: 'long'}).format(
      selectedDayInfo.date
    ) +
    ', ' +
    format(selectedDayInfo.date, 'yyyy-MM-dd')
    : '';

  const overrideType = dayTypes.find((type) => type.identifier === 'override');

  return (
    <div className="context-menu" style={contextMenuStyle} ref={contextMenuRef}>
      {selectedDayInfo && <div className="display-date-info">{displayDate}</div>}
      <div className="close-button" onClick={onClose}>
        &times;
      </div>

      {dayTypes.map((type) => {
        if (type.identifier === 'override' || type.identifier === 'birthday') return null;
        return (
          <DayTypeCheckbox
            key={type._id}
            type={type}
            selected={selectedDayTypes.includes(type._id)}
            onChange={handleCheckboxChange}
          />
        );
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

      {overrideType &&
        (isWeekend(selectedDayInfo.date) || selectedDayInfo.isHolidayDay) && (
          <DayTypeCheckbox
            type={overrideType}
            selected={selectedDayTypes.includes(overrideType._id)}
            onChange={handleCheckboxChange}
          />
        )}
    </div>
  );
};

export default DayTypeContextMenu;
