import {useState} from 'react';
import {eachDayOfInterval} from 'date-fns';
import {getMemberDayEntry, isSelectableDay} from '../utils/calendar';

// Drag-to-select day cells for one member. onSelectionComplete receives
// {teamId, memberId, dates, event, selectionDayTypes} on mouse-up — the day
// types are captured at mouse-down time, before the selection state clears.
// selectedCells intentionally stays populated after mouse-up (the highlight
// remains while the day-type menu is open); callers clear it via clearSelection.
const useDaySelection = ({teamData, holidayData, onSelectionComplete}) => {
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectedCells, setSelectedCells] = useState([]);
  const [selectionDayTypes, setSelectionDayTypes] = useState([]);

  const handleMouseDown = (teamId, memberId, date, isSelectable) => {
    const team = teamData.find(t => t._id === teamId);
    const member = team.team_members.find(m => m.uid === memberId);
    const dayEntry = getMemberDayEntry(member, date);
    const dayTypeIds = (dayEntry.day_types || []).map(dt => dt._id);

    if (!isSelectable && dayTypeIds.length === 0) return;

    setSelectionDayTypes(dayTypeIds);
    setSelectionStart({teamId, memberId, date});
    setSelectedCells([{teamId, memberId, date}]);
  };

  const handleMouseOver = (teamId, memberId, date, member) => {
    if (!selectionStart || selectionStart.memberId !== memberId) return;

    const startDate = selectionStart.date;
    const endDate = date;

    const datesInterval = eachDayOfInterval({
      start: startDate < endDate ? startDate : endDate,
      end: startDate < endDate ? endDate : startDate,
    });

    const newSelection = [];
    for (let d of datesInterval) {
      if (!isSelectableDay(member, d, holidayData, selectionDayTypes)) {
        continue;
      }
      newSelection.push({teamId, memberId, date: d});
    }

    setSelectedCells(newSelection);
  };

  const handleMouseUp = (event) => {
    if (selectedCells.length > 0) {
      const {teamId, memberId} = selectedCells[0];
      const dates = selectedCells.map((cell) => cell.date);
      onSelectionComplete({teamId, memberId, dates, event, selectionDayTypes});
    }

    setSelectionStart(null);
    setSelectionDayTypes([]);
  };

  const clearSelection = () => {
    setSelectedCells([]);
    setSelectionStart(null);
  };

  return {selectedCells, handleMouseDown, handleMouseOver, handleMouseUp, clearSelection};
};

export default useDaySelection;
