import {eachDayOfInterval, endOfWeek, getISOWeek, startOfWeek} from 'date-fns';
import React, {useEffect, useRef, useState} from 'react';
import {Tooltip} from 'react-tooltip';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronRight,
  faEye,
  faGripVertical,
  faInfoCircle,
  faPencilAlt,
  faSave
} from '@fortawesome/free-solid-svg-icons';
import './CalendarComponent.css';
import MonthSelector from './MonthSelector';
import AddTeamModal from './AddTeamModal';
import AddMemberModal from './AddMemberModal';
import DayTypeContextMenu from './DayTypeContextMenu';
import {useApi} from '../hooks/useApi';

const CalendarComponent = ({serverTeamData, holidays, dayTypes, updateTeamData}) => {
  const {apiCall} = useApi();
  const today = new Date();
  const todayMonth = today.getMonth(); // Note: getMonth() returns 0 for January, 1 for February, etc.
  const todayYear = today.getFullYear();

  const [teamData, setTeamData] = useState(serverTeamData);
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [showSaveIcon, setShowSaveIcon] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const addMemberFormRef = useRef(null);
  const [showAddTeamForm, setShowAddTeamForm] = useState(false);
  const stickyHeaderHeight = 44;
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const savedCollapsedTeams = JSON.parse(localStorage.getItem('collapsedTeams')) || [];
  const [collapsedTeams, setCollapsedTeams] = useState(savedCollapsedTeams);
  const savedFocusedTeamId = localStorage.getItem('focusedTeamId');
  const [focusedTeamId, setFocusedTeamId] = useState(savedFocusedTeamId);
  const savedFilter = localStorage.getItem('vacalFilter') || '';
  const [filterInput, setFilterInput] = useState(savedFilter);
  const filterInputRef = useRef(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);
  const contextMenuRef = useRef(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({x: 0, y: 0});
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [draggedMember, setDraggedMember] = useState({memberId: null, originTeamId: null, memberName: ''});
  const [draggingMemberId, setDraggingMemberId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [daysHeader, setDaysHeader] = useState([]);


  const saveToLocalStorage = (key, value) => {
    localStorage.setItem(key, value);
    setShowSaveIcon(true);
    setTimeout(() => setShowSaveIcon(false), 1500); // Hide icon after 1.5 seconds
  };

  const removeFromLocalStorage = (key) => {
    localStorage.removeItem(key);
    setShowSaveIcon(true);
    setTimeout(() => setShowSaveIcon(false), 1500); // Hide icon after 1.5 seconds
  };

  useEffect(() => {
    setTeamData(serverTeamData);
  }, [serverTeamData]);

  useEffect(() => {
    if (filterInputRef.current) {
      filterInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    saveToLocalStorage('collapsedTeams', JSON.stringify(collapsedTeams));
  }, [collapsedTeams]);

  useEffect(() => {
    if (focusedTeamId) {
      saveToLocalStorage('focusedTeamId', focusedTeamId);
    } else {
      removeFromLocalStorage('focusedTeamId');
    }
  }, [focusedTeamId]);

  useEffect(() => {
    saveToLocalStorage('vacalFilter', filterInput);
  }, [filterInput]);

  useEffect(() => {
    if (showAddMemberForm && addMemberFormRef.current) {
      const formPosition = addMemberFormRef.current.getBoundingClientRect().top + window.pageYOffset - stickyHeaderHeight;
      window.scrollTo({top: formPosition, behavior: 'smooth'});
    }
  }, [showAddMemberForm]);

  useEffect(() => {
    if (showContextMenu && contextMenuRef.current) {
      const menuWidth = contextMenuRef.current.offsetWidth;
      let adjustedX = contextMenuPosition.x;

      if (adjustedX + menuWidth > window.innerWidth) {
        adjustedX -= menuWidth;
      }

      if (adjustedX !== contextMenuPosition.x) {
        setContextMenuPosition({x: adjustedX, y: contextMenuPosition.y});
      }
    }
  }, [showContextMenu, contextMenuPosition]);

  const getFirstMonday = (date) => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    return startOfWeek(firstDayOfMonth, {weekStartsOn: 1}); // 1 for Monday
  };

  const getLastSunday = (date) => {
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0); // Last day of the month
    return endOfWeek(lastDayOfMonth, {weekStartsOn: 1});
  };

  useEffect(() => {
    const startDay = getFirstMonday(displayMonth);
    const endDay = getLastSunday(displayMonth);
    const daysInterval = eachDayOfInterval({start: startDay, end: endDay});

    const newDaysHeader = daysInterval.map(date => ({
      day: date.getDate(),
      week: getISOWeek(date),
      date
    }));

    setDaysHeader(newDaysHeader); // Ensure you have a useState or similar to hold this value
  }, [displayMonth]);

  let weekSpans = daysHeader.reduce((acc, curr) => {
    acc.set(curr.week, (acc.get(curr.week) || 0) + 1);
    return acc;
  }, new Map());

  const isWeek1InDecember = daysHeader.some(day => day.week === 1 && displayMonth.getMonth() === 11);

  if (isWeek1InDecember) {
    const sortedWeeks = Array.from(weekSpans.keys()).sort((a, b) => {
      if (a === 1) return 1;  // Push week 1 to the end if it's part of the list
      if (b === 1) return -1; // Push week 1 to the end
      return a - b;
    });

    // Rebuild the weekSpans based on sorted weeks using a new Map
    const sortedWeekSpans = new Map();
    sortedWeeks.forEach(week => {
      sortedWeekSpans.set(week, weekSpans.get(week));
    });
    weekSpans = sortedWeekSpans;
  }


  const filterTeamsAndMembers = (data) => {
    if (!filterInput) return data; // If no filter, return all data

    return data.map(team => {
      // Check if team name matches the filter
      if (team.name.toLowerCase().includes(filterInput.toLowerCase())) {
        return team; // Return the whole team as is
      }

      // Filter team members who match the filter
      const filteredMembers = team.team_members.filter(member =>
        member.name.toLowerCase().includes(filterInput.toLowerCase())
      );

      if (filteredMembers.length > 0) {
        // Return the team with only the filtered members
        return {...team, team_members: filteredMembers};
      }

      return null; // Exclude teams with no matching members
    }).filter(team => team !== null); // Remove null entries (teams with no matches)
  };

  const clearFilter = () => {
    setFilterInput('');
    filterInputRef.current.focus();
  };

  const formatDate = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const isWeekend = (date) => {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
  };

  const isHoliday = (country, date) => {
    const dateStr = formatDate(date);
    if (holidays[country] && holidays[country][dateStr]) {
    }
    return holidays[country] && holidays[country][dateStr];
  };

  const getHolidayName = (country, date) => {
    const dateStr = formatDate(date);
    return holidays[country] && holidays[country][dateStr] ? holidays[country][dateStr] : '';
  };

  const getCellTitle = (member, date) => {
    const dateStr = formatDate(date);
    const dayTypes = member.days[dateStr];

    if (dayTypes && dayTypes.length > 0) {
      return dayTypes.map(dt => dt.name).join(', '); // Join multiple day types with a comma
    }

    const holidayName = getHolidayName(member.country, date);
    if (holidayName) {
      return holidayName;
    }

    if (isWeekend(date)) {
      return 'Weekend';
    }

    return ''; // No special title for regular days
  };

  const handleDayClick = (teamId, memberId, date, event) => {
    event.preventDefault();

    const team = teamData.find(t => t._id === teamId);
    const member = team.team_members.find(m => m.uid === memberId);
    const dateStr = formatDate(date);
    const existingDayTypes = member.days[dateStr] || [];

    setSelectedDayInfo({
      teamId,
      memberId,
      date,
      existingDayTypes
    });

    const xPosition = event.clientX + window.scrollX;
    const yPosition = event.clientY + window.scrollY;

    setContextMenuPosition({x: xPosition, y: yPosition});
    setShowContextMenu(true);
  };

  const deleteTeam = async (teamId) => {
    const teamName = teamData.find(team => team._id === teamId).name;
    if (window.confirm(`Are you sure you want to delete the team '${teamName}'?`)) {
      try {
        await apiCall(`/teams/${teamId}`, 'DELETE');
        updateTeamData();

        if (focusedTeamId === teamId) {
          setFocusedTeamId(null);
        }
      } catch (error) {
        console.error('Error deleting team:', error);
      }
    }
  };

  const deleteTeamMember = async (teamId, memberId) => {
    const member = teamData.find(team => team._id === teamId).team_members.find(member => member.uid === memberId);
    const memberName = member ? member.name : '';

    const message = `To confirm deletion, please type the name of the member: '${memberName}'`;
    const confirmedName = window.prompt(message);

    // Check if the prompt was cancelled
    if (confirmedName === null) {
      return;
    }

    if (confirmedName === memberName) {
      try {
        await apiCall(`/teams/${teamId}/members/${memberId}`, 'DELETE');
        updateTeamData();
      } catch (error) {
        console.error('Error deleting team member:', error);
      }
    } else {
      alert("The entered name did not match. Deletion cancelled.");
    }
  };

  const handleAddTeamIconClick = () => {
    setEditingTeam(null); // Reset editing team to null
    setShowAddTeamForm(true); // Show the Add Team form
  };

  const handleAddMemberIconClick = (teamId) => {
    setEditingMember(null);
    setShowAddMemberForm(true);
    setSelectedTeamId(teamId);
  };

  const toggleTeamCollapse = (teamId) => {
    setCollapsedTeams(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  const handleEditTeamClick = (teamId) => {
    const teamToEdit = teamData.find(team => team._id === teamId);
    setEditingTeam(teamToEdit);
    setShowAddTeamForm(true); // Open the AddTeamModal in edit mode
  };

  const handleEditMemberClick = (teamId, memberId) => {
    const team = teamData.find(t => t._id === teamId);
    const memberToEdit = team.team_members.find(m => m.uid === memberId);
    setEditingMember(memberToEdit);
    setSelectedTeamId(teamId);
    setShowAddMemberForm(true);
  };

  const handleFocusTeam = (teamId) => {
    setFocusedTeamId(prev => (prev === teamId ? null : teamId));
  };

  const renderVacationDaysTooltip = (member) => {
    const selectedYear = displayMonth.getFullYear()
    const vacationDays = member.vacation_days_by_year[selectedYear];
    return vacationDays ? `Vacation days in ${selectedYear}: ${vacationDays}` : `No vacation days in ${selectedYear}`;
  };

  function generateGradientStyle(dateDayTypes) {
    const style = {};

    if (dateDayTypes.length > 0) {
      // Move the "Vacation" day type to the front if it exists
      const vacationIndex = dateDayTypes.findIndex(dayType => dayType.name === "Vacation");
      if (vacationIndex > -1) {
        const [vacationDayType] = dateDayTypes.splice(vacationIndex, 1);
        dateDayTypes.unshift(vacationDayType);
      }

      const percentagePerType = 100 / dateDayTypes.length;
      const gradientParts = dateDayTypes.map((dayType, index) => {
        const start = percentagePerType * index;
        const end = percentagePerType * (index + 1);
        return `${dayType.color} ${start}% ${end}%`;
      });

      style.background = `linear-gradient(to right, ${gradientParts.join(', ')})`;
    }

    return style;
  }

  const handleDragStart = (e, originTeamId, memberId, memberName) => {
    setDraggedMember({memberId, memberName, originTeamId});
    setDraggingMemberId(memberId);
    e.dataTransfer.setData('text/plain', memberId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = (e) => {
    setDraggingMemberId(null);
  };

  const handleDragOver = (e, targetTeamId) => {
    e.preventDefault();
    const {originTeamId} = draggedMember;
    e.dataTransfer.dropEffect = 'move';
    if (targetTeamId !== originTeamId) {
      setDropTargetId(targetTeamId); // Highlight this row as a potential drop target
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDropTargetId(null); // Remove highlight when the dragged item leaves the row
  };

  const handleDrop = async (e, targetTeamId) => {
    e.preventDefault();
    const {memberId, originTeamId, memberName} = draggedMember;
    if (targetTeamId !== originTeamId) {
      const confirmMove = window.confirm(`Are you sure you want to move ${memberName} to the new team?`);
      if (confirmMove) {
        try {
          const response = await apiCall(`/move-team-member/${memberId}`, 'POST', {
            source_team_id: originTeamId,
            target_team_id: targetTeamId,
          });
          updateTeamData();
        } catch (error) {
          console.error('Failed to move team member:', error);
        }
      }
    }
    setDropTargetId(null); // Remove highlight when the dragged item leaves the row
    setDraggedMember({memberId: null, originTeamId: null, memberName: ''}); // Reset drag state
  };

  const updateLocalTeamData = (teamId, memberId, dateStr, newDayTypes) => {

    const getDayTypeById = (id) => {
      return dayTypes.find(dayType => dayType._id === id);
    };

    setTeamData(teamData => {
      return teamData.map(team => {
        if (team._id === teamId) {
          const updatedMembers = team.team_members.map(member => {
            if (member.uid === memberId) {
              return {...member, days: {...member.days, [dateStr]: newDayTypes.map(id => getDayTypeById(id))}};
            }
            return member;
          });
          return {...team, team_members: updatedMembers};
        }
        return team;
      });
    });
  };


  return (
    <div>
      <AddTeamModal
        isOpen={showAddTeamForm}
        onClose={() => {
          setShowAddTeamForm(false);
          setEditingTeam(null);
        }}
        updateTeamData={updateTeamData}
        editingTeam={editingTeam}
      />

      <AddMemberModal
        isOpen={showAddMemberForm}
        onClose={() => {
          setShowAddMemberForm(false);
          setEditingMember(null);
        }}
        selectedTeamId={selectedTeamId}
        updateTeamData={updateTeamData}
        editingMember={editingMember}
      />
      <DayTypeContextMenu
        contextMenuRef={contextMenuRef}
        isOpen={showContextMenu}
        position={contextMenuPosition}
        onClose={() => setShowContextMenu(false)}
        dayTypes={dayTypes}
        selectedDayInfo={selectedDayInfo}
        updateTeamData={updateTeamData}
        updateLocalTeamData={updateLocalTeamData}
      />

      <div className="stickyHeader">
        <MonthSelector
          displayMonth={displayMonth}
          setDisplayMonth={setDisplayMonth}
          todayYear={todayYear}
          todayMonth={todayMonth}
        />
        <input
          type="text"
          ref={filterInputRef}
          value={filterInput}
          onChange={(e) => setFilterInput(e.target.value)}
          placeholder="Filter by team or member name"
        />
        {filterInput && (
          <button onClick={clearFilter}>Clear</button>
        )}
        {showSaveIcon && <FontAwesomeIcon icon={faSave} className="save-icon"/>}
      </div>
      <div className="contentBelowStickyHeader">
        <table className="calendar-table">
          <colgroup>
            <col/>
            {/* This col is for the non-date column */}
            {daysHeader.map(({date}, idx) => (
              <col key={idx} className={isWeekend(date) ? 'weekend-column' : ''}/>
            ))}
          </colgroup>
          <thead>
          <tr>
            <th></th>
            {Array.from(weekSpans).map(([week, span], idx) => (
              <th key={idx} colSpan={span} className="week-number-header">
                {span < 2 ? week : `Week ${week}`}
              </th>
            ))}
          </tr>
          <tr>
            <th>
              Team<span className="add-icon" onClick={handleAddTeamIconClick} title="Add team">➕ </span>
              / Member
            </th>
            {daysHeader.map(({day, date}, idx) => (
              <th key={idx}
                  className={formatDate(date) === formatDate(today) ? 'current-day-number' : 'day-number-header'}>
                {day}
              </th>
            ))}
          </tr>
          </thead>
          <tbody>
          {filterTeamsAndMembers(teamData).map(team => (
            <React.Fragment key={team.id}>
              {(!focusedTeamId || focusedTeamId === team._id) && (
                <>
                  <tr
                    className={`team-row ${dropTargetId === team._id ? 'drop-target' : ''}`}
                    onDragOver={(e) => handleDragOver(e, team._id)}
                    onDragLeave={(e) => handleDragLeave(e)}
                    onDrop={(e) => handleDrop(e, team._id)}
                  >
                    <td className="team-name-cell">
                      <span className="collapse-icon"
                            onClick={() => toggleTeamCollapse(team._id)}>
                          <FontAwesomeIcon
                            icon={collapsedTeams.includes(team._id) ? faChevronRight : faChevronDown}/>
                      </span>
                      <span className={`eye-icon ${focusedTeamId === team._id ? 'eye-icon-active' : ''}`}
                            onClick={() => handleFocusTeam(team._id)}>
                          <FontAwesomeIcon icon={faEye}/>
                      </span>
                      {team.name}
                      {team.team_members.length === 0 && (
                        <span className="delete-icon" onClick={() => deleteTeam(team._id)}>🗑️</span>
                      )}
                      <span className="add-icon" onClick={() => handleAddMemberIconClick(team._id)}
                            title="Add team member">➕</span>
                      <span className="edit-icon" onClick={() => handleEditTeamClick(team._id)}>
                          <FontAwesomeIcon icon={faPencilAlt}/>
                      </span>
                    </td>
                    {daysHeader.map((day, idx) =>  <td key={idx}></td>)} {/* Empty cells for team row */}
                  </tr>
                  {!collapsedTeams.includes(team._id) && team.team_members.map(member => (
                    <tr key={member.uid} className={draggingMemberId === member.uid ? 'dragging' : ''}>
                      <td className="member-name-cell">
                        {member.name} <span title={member.country}>{member.country_flag}</span>
                        <span className="info-icon" data-tip data-tooltip-id={`tooltip-${member.uid}`}>
                            <FontAwesomeIcon icon={faInfoCircle}/>
                        </span>
                        <Tooltip id={`tooltip-${member.uid}`} place="top" effect="solid">
                          {renderVacationDaysTooltip(member)}
                        </Tooltip>
                        <span
                          className="drag-icon"
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, team._id, member.uid, member.name)}
                          onDragEnd={handleDragEnd}
                          title="Drag and drop">
                              <FontAwesomeIcon icon={faGripVertical}/>
                          </span>
                        <span className="edit-icon" onClick={() => handleEditMemberClick(team._id, member.uid)}>
                            <FontAwesomeIcon icon={faPencilAlt}/>
                        </span>
                        <span className="delete-icon" onClick={() => deleteTeamMember(team._id, member.uid)}>🗑️</span>
                      </td>
                      {daysHeader.map(({date}, idx) =>  {
                        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        const dateDayTypes = member.days[dateStr] || [];
                        const isHolidayDay = isHoliday(member.country, date);

                        return (
                          <td
                            key={idx}
                            onClick={(e) => handleDayClick(team._id, member.uid, date, e)}
                            title={getCellTitle(member, date)}
                            className={isHolidayDay ? 'holiday-cell' : ''}
                            style={generateGradientStyle(dateDayTypes)}
                          >
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              )}
            </React.Fragment>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CalendarComponent;