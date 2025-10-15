import React, {useEffect, useMemo, useState} from 'react';
import './DayTypeContextMenu.css';
import {format, isWeekend} from 'date-fns';
import {toast} from 'react-toastify';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faHistory} from '@fortawesome/free-solid-svg-icons';
import DayTypeCheckbox from './DayTypeCheckbox';
import DayHistoryModal from './DayHistoryModal';
import useDayAssignmentsMutation from '../hooks/mutations/useDayAssignmentsMutation';

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
  const dayAssignmentsMutation = useDayAssignmentsMutation();

  const visibleDayTypes = dayTypes;
  const {activeTeam, activeMember, dateRange, firstDate} = useMemo(() => {
    if (!selectedDayInfo) {
      return {
        activeTeam: null,
        activeMember: null,
        dateRange: [],
        firstDate: null,
      };
    }

    const resolvedDates = selectedDayInfo.dateRange ?? [];
    const resolvedTeam = teamData?.find((t) => t._id === selectedDayInfo.teamId) ?? null;
    const resolvedMember = resolvedTeam?.team_members?.find((m) => m.uid === selectedDayInfo.memberId) ?? null;

    return {
      activeTeam: resolvedTeam,
      activeMember: resolvedMember,
      dateRange: resolvedDates,
      firstDate: resolvedDates.length > 0 ? resolvedDates[0] : null,
    };
  }, [selectedDayInfo, teamData]);

  const isHolidayDay = selectedDayInfo?.isHolidayDay ?? false;

  const editableDayTypeIds = useMemo(() => {
    const ids = new Set();

    visibleDayTypes.forEach((type) => {
      if (type.identifier === 'vacation') {
        ids.add(type._id);
        return;
      }

      if (type.identifier === 'birthday') {
        return;
      }

      if (type.identifier === 'override' && firstDate) {
        const canEditOverride = isWeekend(firstDate) || isHolidayDay;
        if (!canEditOverride) return;
      }

      ids.add(type._id);
    });

    return ids;
  }, [firstDate, isHolidayDay, visibleDayTypes]);

  useEffect(() => {
    if (isOpen && selectedDayInfo) {
      const existingDayTypes = selectedDayInfo.existingDayTypes ?? [];
      const dayTypeIds = existingDayTypes.map((type) => type._id);
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
    if (!isOpen || !selectedDayInfo || !activeMember || dateRange.length === 0) return;

    const persistedDayTypeIds = Array.from(new Set(
      dateRange.flatMap((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayTypesForDate = activeMember.days?.[dateStr]?.day_types || [];
        return dayTypesForDate.map((dt) => dt._id);
      }),
    ));

    const isSyncNeeded =
      persistedDayTypeIds.length !== selectedDayTypes.length ||
      !persistedDayTypeIds.every((id) => selectedDayTypes.includes(id));

    if (isSyncNeeded) {
      setSelectedDayTypes(persistedDayTypeIds);
    }
  }, [activeMember, dateRange, isOpen, selectedDayInfo, selectedDayTypes]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCheckboxChange = async (typeObj, checked) => {
    if (!selectedDayInfo) {
      toast.error('Unable to update day types. Please try again.');
      return;
    }

    const value = typeObj._id;
    const updatedDayTypes = checked
      ? [...selectedDayTypes, value]
      : selectedDayTypes.filter((type) => type !== value);

    if (typeObj.identifier === 'vacation' && checked) {
      if (!activeTeam || !activeMember) {
        toast.error('Vacation balance is unavailable. Please refresh and try again.');
        return;
      }

      const currentYear = new Date().getFullYear();
      const allFutureYears = dateRange.length > 0 && dateRange.every((date) => date.getFullYear() > currentYear);

      if (!allFutureYears &&
          activeMember.vacation_available_days != null &&
          dateRange.length > activeMember.vacation_available_days) {
        const proceed = window.confirm('Not enough vacation days available. Do you want to continue?');
        if (!proceed) {
          return;
        }
      }
    }

    setSelectedDayTypes(updatedDayTypes);
    await updateDayData(updatedDayTypes, comment);
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
    if (!selectedDayInfo) {
      console.error('Selected day info missing for update.');
      toast.error('Unable to update day types. Please refresh and try again.');
      return false;
    }

    if (!activeTeam || !activeMember) {
      console.error('Team or member data missing for update.');
      toast.error('Unable to update day types. Please refresh and try again.');
      return false;
    }

    if (dateRange.length === 0) {
      console.error('No valid date range provided.');
      return false;
    }

    const dayTypeData = {};

    dateRange.forEach((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const currentEntry = activeMember.days?.[dateStr] || {};
      const currentIds = (currentEntry.day_types || []).map((dt) => dt._id);

      const preservedIds = currentIds.filter((id) => !editableDayTypeIds.has(id));
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

    try {
      await dayAssignmentsMutation.mutateAsync({
        teamId: selectedDayInfo.teamId,
        memberId: selectedDayInfo.memberId,
        payload: dayTypeData,
      });
      updateTeamData();
      setComment(comment);
      setInitialComment(comment);
      return true;
    } catch (error) {
      console.error('Error updating day types:', error);
      const detailMessage = error?.data?.detail;
      toast.error(detailMessage || 'Error updating day types');
      return false;
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

      <textarea
        className="comment-input"
        placeholder="Add a comment"
        value={comment}
        onChange={handleCommentChange}
        onBlur={handleCommentBlur}
      />

      {selectedDayInfo && (
        <div className="member-info">
          {selectedDayInfo.memberName}
          <br/>
        </div>
      )}

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
