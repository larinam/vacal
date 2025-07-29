import React, {useEffect, useState} from 'react';
import './DayTypeContextMenu.css';
import {useApi} from '../hooks/useApi';
import {format, isWeekend} from 'date-fns';
import {toast} from 'react-toastify';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faHistory} from '@fortawesome/free-solid-svg-icons';
import DayTypeCheckbox from './DayTypeCheckbox';
import DayHistoryModal from './DayHistoryModal';

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
  const [showHistory, setShowHistory] = useState(false);
  const {apiCall} = useApi();

  const visibleDayTypes =
    isOpen &&
    selectedDayInfo &&
    selectedDayInfo.dateRange?.length > 1 &&
    selectedDayInfo.existingDayTypes?.length > 0
      ? selectedDayInfo.existingDayTypes
      : dayTypes;

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

    if (typeObj.identifier === 'vacation' && checked) {
      const team = teamData.find(t => t._id === selectedDayInfo.teamId);
      const member = team.team_members.find(m => m.uid === selectedDayInfo.memberId);
      const currentYear = new Date().getFullYear();
      const allFutureYears = selectedDayInfo.dateRange.every(date => date.getFullYear() > currentYear);
      if (!allFutureYears &&
          member.vacation_available_days != null &&
          selectedDayInfo.dateRange.length > member.vacation_available_days) {
        const proceed = window.confirm('Not enough vacation days available. Do you want to continue?');
        if (!proceed) {
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

  const openHistoryModal = () => setShowHistory(true);
  const closeHistoryModal = () => setShowHistory(false);

  const updateDayData = async (dayTypes, comment) => {
    const baseTypeIds = selectedDayInfo.existingDayTypes.map((t) => t._id);
    const dayTypeData = {};

    if (selectedDayInfo.dateRange && selectedDayInfo.dateRange.length > 0) {
      selectedDayInfo.dateRange.forEach((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const team = teamData.find((t) => t._id === selectedDayInfo.teamId);
        const member = team.team_members.find((m) => m.uid === selectedDayInfo.memberId);
        const currentEntry = member.days[dateStr] || {};
        const currentIds = (currentEntry.day_types || []).map((dt) => dt._id);

        const preservedIds = currentIds.filter((id) => !baseTypeIds.includes(id));
        const finalIds = Array.from(new Set([...dayTypes, ...preservedIds]));

        dayTypeData[dateStr] = {day_types: finalIds, comment};
        updateLocalTeamData(
          selectedDayInfo.teamId,
          selectedDayInfo.memberId,
          dateStr,
          finalIds,
          comment,
        );
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
    <>
    <div className="context-menu" style={contextMenuStyle} ref={contextMenuRef}>
      {selectedDayInfo && (
        <div className="display-date-info">
          {displayDate}
            {selectedDayInfo.dateRange && selectedDayInfo.dateRange.length === 1 && (
            <span className="history-icon" onClick={openHistoryModal} title="View history">
              <FontAwesomeIcon icon={faHistory}/>
            </span>
          )}
        </div>
      )}
      <div className="close-button" onClick={onClose}>
        &times;
      </div>

      {visibleDayTypes.map((type) => {
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

      {visibleDayTypes
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
    <DayHistoryModal
      isOpen={showHistory}
      onClose={closeHistoryModal}
      teamId={selectedDayInfo?.teamId}
      memberId={selectedDayInfo?.memberId}
      date={selectedDayInfo?.dateRange && selectedDayInfo.dateRange.length > 0 ? format(selectedDayInfo.dateRange[0], 'yyyy-MM-dd') : ''}
    />
    </>
  );
};

export default DayTypeContextMenu;
