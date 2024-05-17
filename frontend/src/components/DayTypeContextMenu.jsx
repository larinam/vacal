import React, {useEffect, useState} from 'react';
import './DayTypeContextMenu.css';
import {useApi} from '../hooks/useApi';
import {format, isWeekend} from "date-fns";

const DayTypeContextMenu = ({
                              contextMenuRef,
                              isOpen,
                              position,
                              onClose,
                              dayTypes,
                              selectedDayInfo,
                              updateTeamData,
                              updateLocalTeamData
                            }) => {
  const [selectedDayTypes, setSelectedDayTypes] = useState([]);
  const {apiCall} = useApi();

  useEffect(() => {
    if (selectedDayInfo?.existingDayTypes) {
      const dayTypeIds = selectedDayInfo.existingDayTypes.map(type => type._id);
      setSelectedDayTypes(dayTypeIds);
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

    const dateStr = formatDate(selectedDayInfo.date);
    const dayTypeData = {[dateStr]: {"day_types": updatedDayTypes}};

    const url = `/teams/${selectedDayInfo.teamId}/members/${selectedDayInfo.memberId}/days`;
    try {
      await apiCall(url, 'PUT', dayTypeData);
      updateTeamData();
    } catch (error) {
      console.error('Error updating day types:', error);
    }

    updateLocalTeamData(
      selectedDayInfo.teamId,
      selectedDayInfo.memberId,
      formatDate(selectedDayInfo.date),
      updatedDayTypes
    );
    onClose();
  };

  const formatDate = (date) => {
    return format(date, 'yyyy-MM-dd');
  };

  if (!isOpen) return null;

  const contextMenuStyle = {
    position: 'absolute',
    top: `${position.y}px`,
    left: `${position.x}px`,
  };

  // Format the display of the date and the day of the week
  const displayDate = selectedDayInfo.date ?
    new Intl.DateTimeFormat(navigator.language, {weekday: 'long'}).format(selectedDayInfo.date) + ', ' + formatDate(selectedDayInfo.date) : "";


  return (
    <div className="context-menu" style={contextMenuStyle} ref={contextMenuRef}>
      {selectedDayInfo && (
        <div className="display-date-info">
          {displayDate}
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
      {selectedDayInfo && (
        <div className="member-info">
          {selectedDayInfo.memberName}<br/>
        </div>
      )}
    </div>
  );
};

export default DayTypeContextMenu;
