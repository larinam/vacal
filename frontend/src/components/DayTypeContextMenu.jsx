import React, {useEffect, useState} from 'react';
import './DayTypeContextMenu.css';
import {useApi} from '../hooks/useApi';
import {format, isWeekend} from "date-fns";
import {toast} from "react-toastify";

const DayTypeContextMenu = ({
                              contextMenuRef,
                              isOpen,
                              position,
                              onClose,
                              dayTypes,
                              selectedDayInfo,
                              selectedRange, // Receive the selected range
                              updateTeamData,
                              updateLocalTeamData
                            }) => {
  const [selectedDayTypes, setSelectedDayTypes] = useState([]);
  const [comment, setComment] = useState('');
  const [initialComment, setInitialComment] = useState('');
  const {apiCall} = useApi();

  useEffect(() => {
    if (isOpen && selectedDayInfo) {
      const dayTypeIds = selectedDayInfo.existingDayTypes.map(type => type._id);
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
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCheckboxChange = async (e) => {
    const checked = e.target.checked;
    const value = e.target.value;
    const updatedDayTypes = checked
      ? [...selectedDayTypes, value]
      : selectedDayTypes.filter(type => type !== value);

    setSelectedDayTypes(updatedDayTypes);
    await updateDayData(updatedDayTypes, comment);
    onClose();
  };

  const handleCommentChange = (e) => {
    setComment(e.target.value);
  };

  const handleCommentBlur = async () => {
    if (comment !== initialComment) {
      await updateDayData(selectedDayTypes, comment);
    }
  };

  const updateDayData = async (dayTypes, comment) => {
    if (!selectedDayInfo) return; // Ensure selectedDayInfo is valid
    const daysToUpdate = getDaysInRange(selectedRange);
    const dayTypeData = {};

    daysToUpdate.forEach(dateStr => {
      dayTypeData[dateStr] = {"day_types": dayTypes, "comment": comment};
    });

    const url = `/teams/${selectedDayInfo.teamId}/members/${selectedDayInfo.memberId}/days`;
    try {
      await apiCall(url, 'PUT', dayTypeData);
      updateTeamData();
    } catch (error) {
      console.error('Error updating day types:', error);
      toast.error(error?.data?.detail);
    }

    // Update the local state for all selected days
    daysToUpdate.forEach(dateStr => {
      updateLocalTeamData(
        selectedDayInfo.teamId,
        selectedDayInfo.memberId,
        dateStr,
        dayTypes,
        comment
      );
    });
  };

  const getDaysInRange = (range) => {
    if (!range.start || !range.end) return []; // Handle null or undefined ranges
    const start = new Date(range.start.date);
    const end = new Date(range.end.date);
    const dates = [];

    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(formatDate(new Date(d)));
    }

    return dates;
  };


  const formatDate = (date) => {
    return format(date, 'yyyy-MM-dd');
  };

  if (!isOpen || !selectedDayInfo) return null; // Handle cases where the menu should not be rendered

  const contextMenuStyle = {
    position: 'absolute',
    top: `${position.y}px`,
    left: `${position.x}px`,
  };

  const displayDate = selectedDayInfo.date ?
    new Intl.DateTimeFormat(navigator.language, {weekday: 'long'}).format(selectedDayInfo.date) + ', ' + formatDate(selectedDayInfo.date) : "";

  return (
    <div className="context-menu" style={contextMenuStyle} ref={contextMenuRef}>
      {selectedRange.start && selectedRange.end && (
        <div className="display-date-info">
          {formatDate(selectedRange.start.date)} - {formatDate(selectedRange.end.date)}
        </div>
      )}
      <div className="close-button" onClick={onClose}>&times;</div>
      {dayTypes.map(type => {
        // If the DayType identifier is "override", only show it if it's a weekend or holiday
        if (type.identifier === "override" && !isWeekend(selectedDayInfo.date) && !selectedDayInfo.isHolidayDay) {
          return null; // Skip this DayType
        }
        if (type.identifier === "birthday") {
          return null; // Skip this DayType
        }

        return (
          <div key={type._id} className="day-type-item">
            <input
              type="checkbox"
              id={`dayType-${type._id}`}
              value={type._id}
              onChange={handleCheckboxChange}
              checked={selectedDayTypes.includes(type._id)}
            />
            <label htmlFor={`dayType-${type._id}`}>
              <span className="color-indicator" style={{backgroundColor: type.color}}></span>
              {type.name}
            </label>
          </div>
        );
      })}
      <textarea
        className="comment-input"
        placeholder="Add a comment"
        value={comment}
        onChange={handleCommentChange}
        onBlur={handleCommentBlur}
      />
    </div>
  );
};

export default DayTypeContextMenu;
