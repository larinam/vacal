import {eachDayOfInterval, endOfWeek, format, getISOWeek, isToday, isWeekend, isYesterday, startOfWeek} from 'date-fns';
import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
  faBell as faSolidBell,
  faChevronDown,
  faChevronRight,
  faEdit,
  faEye,
  faGripVertical,
  faInfoCircle,
  faHistory,
  faLink,
  faSave,
  faTrashAlt
} from '@fortawesome/free-solid-svg-icons';
import {faBell as faRegularBell} from '@fortawesome/free-regular-svg-icons';
import {toast} from 'react-toastify';
import './CalendarComponent.css';
import MonthSelector from './MonthSelector';
import TeamModal from './TeamModal';
import MemberModal from './MemberModal';
import DayTypeContextMenu from './DayTypeContextMenu';
import TeamSubscriptionContextMenu from './TeamSubscriptionContextMenu';
import MemberHistoryModal from './MemberHistoryModal';
import DeleteMemberModal from './DeleteMemberModal';
import {useAuth} from '../contexts/AuthContext';
import {useLocalStorage} from '../hooks/useLocalStorage';
import {API_URL} from '../utils/apiConfig';
import {useApi} from '../hooks/useApi';
import useTeamManagementMutations from '../hooks/mutations/useTeamManagementMutations';
import useMemberMutations from '../hooks/mutations/useMemberMutations';
import FontAwesomeIconWithTitle from './FontAwesomeIconWithTitle';
import {useQueries} from '@tanstack/react-query';
import {HOLIDAYS_QUERY_KEY} from '../hooks/queries/useHolidaysQuery';

const CalendarComponent = ({serverTeamData, holidays, dayTypes, updateTeamData}) => {
  const {deleteTeamMutation, moveMemberMutation} = useTeamManagementMutations();
  const {deleteMemberMutation} = useMemberMutations();
  const {user} = useAuth();
  const {apiCall} = useApi();
  const canManageMembers = user?.role === 'manager';
  const today = new Date();
  const todayMonth = today.getMonth(); // Note: getMonth() returns 0 for January, 1 for February, etc.
  const todayYear = today.getFullYear();

  const [teamData, setTeamData] = useState(serverTeamData);
  const [holidayData, setHolidayData] = useState(holidays || {});
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [showSaveIcon, setShowSaveIcon] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const addMemberFormRef = useRef(null);
  const [showAddTeamForm, setShowAddTeamForm] = useState(false);
  const stickyHeaderHeight = 44;
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [collapsedTeams, setCollapsedTeams] = useLocalStorage('collapsedTeams', []);
  const [focusedTeamId, setFocusedTeamId] = useLocalStorage('focusedTeamId', null);
  const [filterInput, setFilterInput] = useLocalStorage('vacalFilter', '');
  const filterInputRef = useRef(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);
  const [showMemberHistory, setShowMemberHistory] = useState(false);
  const [memberHistoryInfo, setMemberHistoryInfo] = useState({teamId: null, memberId: null, memberName: ''});
  const [showDeleteMemberModal, setShowDeleteMemberModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const contextMenuRef = useRef(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({x: 0, y: 0});
  const [showContextMenu, setShowContextMenu] = useState(false);
  const subscriptionMenuRef = useRef(null);
  const [subscriptionMenuPosition, setSubscriptionMenuPosition] = useState({x: 0, y: 0});
  const [showSubscriptionMenu, setShowSubscriptionMenu] = useState(false);
  const [subscriptionTeamId, setSubscriptionTeamId] = useState(null);
  const [draggedMember, setDraggedMember] = useState({memberId: null, originTeamId: null, memberName: ''});
  const [draggingMemberId, setDraggingMemberId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [daysHeader, setDaysHeader] = useState([]);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectedCells, setSelectedCells] = useState([]);
  const [selectionDayTypes, setSelectionDayTypes] = useState([]);

  const haveSameDayTypes = (first = [], second = []) => {
    if (first.length !== second.length) {
      return false;
    }
    const sortedFirst = [...first].sort();
    const sortedSecond = [...second].sort();
    return sortedFirst.every((value, index) => value === sortedSecond[index]);
  };

  const isSelectableDay = (member, date, baseTypes = []) => {
    const dayEntry = getMemberDayEntry(member, date);
    const dayTypeIds = (dayEntry?.day_types || []).map(dt => dt._id);

    if (baseTypes.length > 0) {
      return haveSameDayTypes(baseTypes, dayTypeIds);
    }

    const hasExistingDayTypes = dayTypeIds.length > 0;

    return (
      !isWeekend(date) &&
      !isHoliday(member.country, date) &&
      !hasExistingDayTypes
    );
  };

  const showDayContextMenu = (teamId, memberId, dates, event, isHolidayDay = false) => {
    const team = teamData.find((team) => team._id === teamId);
    const member = team.team_members.find((m) => m.uid === memberId);
    const memberName = member.name;

    let existingDayTypes = [];
    let existingComment = '';

    if (dates.length === 1) {
      const dayEntry = getMemberDayEntry(member, dates[0]);
      existingDayTypes = dayEntry?.day_types || [];
      existingComment = dayEntry?.comment || '';
    } else {
      if (selectionDayTypes.length > 0) {
        existingDayTypes = dayTypes.filter(dt => selectionDayTypes.includes(dt._id));
      }

      const comments = dates.map((date) => {
        return getMemberDayComment(member, date);
      });
      const uniqueComments = Array.from(new Set(comments));
      if (uniqueComments.length === 1) {
        existingComment = uniqueComments[0];
      }
    }

    setSelectedDayInfo({
      teamId,
      memberId,
      memberName,
      dateRange: dates,
      existingDayTypes,
      existingComment,
      isHolidayDay
    });

    const xPosition = event.clientX + window.scrollX;
    const yPosition = event.clientY + window.scrollY;
    setContextMenuPosition({x: xPosition, y: yPosition});
    setShowContextMenu(true);
  };

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
      if (!isSelectableDay(member, d, selectionDayTypes)) {
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
      showDayContextMenu(teamId, memberId, dates, event);
    }

    setSelectionStart(null);
    setSelectionDayTypes([]);
  };

  const openMemberHistory = (teamId, member) => {
    setMemberHistoryInfo({teamId, memberId: member.uid, memberName: member.name});
    setShowMemberHistory(true);
  };


  const triggerSaveIcon = () => {
    setShowSaveIcon(true);
    setTimeout(() => setShowSaveIcon(false), 1500);
  };

  useEffect(() => {
    setTeamData(serverTeamData);
  }, [serverTeamData]);

  useEffect(() => {
    setHolidayData(holidays || {});
  }, [holidays]);

  const loadedHolidayYears = useMemo(() => {
    const years = new Set();
    Object.values(holidayData || {}).forEach(countryHolidays => {
      Object.keys(countryHolidays || {}).forEach(dateStr => {
        const [year] = dateStr.split('-');
        const parsedYear = Number(year);
        if (!Number.isNaN(parsedYear)) {
          years.add(parsedYear);
        }
      });
    });
    return years;
  }, [holidayData]);

  const selectedYear = displayMonth.getFullYear();
  const displayedYears = useMemo(() => {
    const years = new Set();
    daysHeader.forEach(({date}) => years.add(date.getFullYear()));

    if (years.size === 0) {
      years.add(selectedYear);
    }

    return Array.from(years).sort();
  }, [daysHeader, selectedYear]);

  const missingYears = useMemo(
    () => displayedYears.filter((year) => !loadedHolidayYears.has(year)),
    [displayedYears, loadedHolidayYears]
  );

  const holidayQueries = useQueries({
    queries: missingYears.map((year) => ({
      queryKey: [...HOLIDAYS_QUERY_KEY, year],
      queryFn: ({signal}) => apiCall(`/holidays?year=${year}`, 'GET', null, false, signal),
      enabled: true,
    })),
  });

  useEffect(() => {
    const responses = holidayQueries
      .map((query) => query.data)
      .filter((response) => response?.holidays);

    if (responses.length === 0) {
      return;
    }

    setHolidayData((prevHolidays) => {
      return responses.reduce((acc, current) => {
        Object.entries(current.holidays).forEach(([country, countryHolidays]) => {
          acc[country] = {
            ...(acc[country] || {}),
            ...countryHolidays,
          };
        });
        return acc;
      }, {...prevHolidays});
    });
  }, [holidayQueries]);

  useEffect(() => {
    holidayQueries.forEach((query, index) => {
      if (query.error) {
        console.error('Failed to fetch holidays for year', missingYears[index], query.error);
      }
    });
  }, [holidayQueries, missingYears]);

  useEffect(() => {
    if (filterInputRef.current) {
      filterInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    triggerSaveIcon();
  }, [collapsedTeams, focusedTeamId, filterInput]);

  useEffect(() => {
    if (showAddMemberForm && addMemberFormRef.current) {
      const formPosition = addMemberFormRef.current.getBoundingClientRect().top + window.pageYOffset - stickyHeaderHeight;
      window.scrollTo({top: formPosition, behavior: 'smooth'});
    }
  }, [showAddMemberForm]);

  useLayoutEffect(() => {
    if (showContextMenu && contextMenuRef.current) {
      const menuWidth = contextMenuRef.current.offsetWidth;
      let adjustedX = contextMenuPosition.x;

      if (adjustedX + menuWidth > window.innerWidth) {
        adjustedX = Math.max(0, adjustedX - menuWidth);
      }

      if (adjustedX !== contextMenuPosition.x) {
        setContextMenuPosition({x: adjustedX, y: contextMenuPosition.y});
      }
    }
  }, [showContextMenu, contextMenuPosition]);

  useLayoutEffect(() => {
    if (showSubscriptionMenu && subscriptionMenuRef.current) {
      const menuWidth = subscriptionMenuRef.current.offsetWidth;
      let adjustedX = subscriptionMenuPosition.x;

      if (adjustedX + menuWidth > window.innerWidth) {
        adjustedX = Math.max(0, adjustedX - menuWidth);
      }

      if (adjustedX !== subscriptionMenuPosition.x) {
        setSubscriptionMenuPosition({x: adjustedX, y: subscriptionMenuPosition.y});
      }
    }
  }, [showSubscriptionMenu, subscriptionMenuPosition]);

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

    const weekdayFormatter = new Intl.DateTimeFormat(navigator.language, {weekday: 'short'});

    const newDaysHeader = daysInterval.map(date => ({
      day: date.getDate(),
      week: getISOWeek(date),
      weekday: weekdayFormatter.format(date),
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

  const formatDate = (date) => {
    return format(date, 'yyyy-MM-dd');
  };

  const getMemberDayEntry = (member, date) => {
    const dateStr = formatDate(date);
    return member?.days?.[dateStr] || {};
  };

  const getMemberDayComment = (member, date) => {
    const entry = getMemberDayEntry(member, date);
    return entry?.comment || '';
  };

  const isHoliday = (country, date) => {
    const dateStr = formatDate(date);
    return holidayData[country] && holidayData[country][dateStr];
  };

  const getHolidayName = (country, date) => {
    const dateStr = formatDate(date);
    return holidayData[country] && holidayData[country][dateStr] ? holidayData[country][dateStr] : '';
  };

  const getCellTitle = (member, date) => {
    const dayEntry = getMemberDayEntry(member, date);
    const dayTypes = dayEntry?.day_types || [];
    const comment = (dayEntry?.comment || '').trim();

    if (dayTypes && dayTypes.length > 0) {
      const dayTypesText = dayTypes.map(dt => dt.name).join(', '); // Join multiple day types with a comma
      return comment ? `${dayTypesText}: ${comment}` : dayTypesText;
    }

    if (comment) {
      return comment;
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

  const handleDayClick = (teamId, memberId, date, isHolidayDay, event) => {
    event.preventDefault();
    showDayContextMenu(teamId, memberId, [date], event, isHolidayDay);
  };

  const deleteTeam = (teamId) => {
    const teamName = teamData.find(team => team._id === teamId).name;
    if (window.confirm(`Are you sure you want to delete the team '${teamName}'?`)) {
      deleteTeamMutation.mutate(
        {teamId},
        {
          onSuccess: () => {
            toast.success(`Team '${teamName}' deleted`);
            updateTeamData();
            if (focusedTeamId === teamId) {
              setFocusedTeamId(null);
            }
          },
          onError: (error) => {
            console.error('Error deleting team:', error);
            toast.error('Error deleting team');
          },
        },
      );
    }
  };

  const openDeleteMemberModal = (teamId, memberId) => {
    const team = teamData.find(t => t._id === teamId);
    const member = team?.team_members.find(m => m.uid === memberId);

    if (!team || !member) {
      toast.error('Unable to identify the selected team member.');
      return;
    }

    setMemberToDelete({teamId, member});
    setShowDeleteMemberModal(true);
  };

  const closeDeleteMemberModal = () => {
    setShowDeleteMemberModal(false);
    setMemberToDelete(null);
  };

  const handleConfirmDeleteMember = ({lastWorkingDay, departureInitiatedBy}) => {
    if (!memberToDelete) {
      return;
    }

    const {teamId, member} = memberToDelete;

    deleteMemberMutation.mutate(
      {
        teamId,
        memberId: member.uid,
        payload: {
          last_working_day: lastWorkingDay,
          departure_initiated_by: departureInitiatedBy,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Member ${member.name} deleted`);
          if (typeof updateTeamData === 'function') {
            updateTeamData();
          }
          closeDeleteMemberModal();
        },
        onError: (error) => {
          console.error('Error deleting team member:', error);
          toast.error('Error deleting team member');
        },
      }
    );
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

  const handleCopyCalendarLink = (teamId) => {
    const link = `${API_URL}/teams/calendar/${teamId}?user_api_key=${user.auth_details.api_key}`;
    navigator.clipboard.writeText(link).then(() => {
      toast.success('Calendar link copied');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  const openSubscriptionMenu = (event, teamId) => {
    event.stopPropagation();
    const xPosition = event.clientX + window.scrollX;
    const yPosition = event.clientY + window.scrollY;
    setSubscriptionMenuPosition({x: xPosition, y: yPosition});
    setSubscriptionTeamId(teamId);
    setShowSubscriptionMenu(true);
  };

  const closeSubscriptionMenu = () => {
    setShowSubscriptionMenu(false);
    setSubscriptionTeamId(null);
  };

  const renderVacationDaysTooltip = (member) => {
    const selectedYear = displayMonth.getFullYear();
    const currentYear = new Date().getFullYear();
    const usedDays = member.vacation_used_days_by_year?.[selectedYear] || 0;
    const plannedDays = member.vacation_planned_days_by_year?.[selectedYear] || 0;
    const yearlyVacationDays = member.yearly_vacation_days;
    const availableVacationDays = member.vacation_available_days;
    const usedText = usedDays
      ? `${usedDays} vacation days used in ${selectedYear}`
      : `No vacation days used in ${selectedYear}`;
    const plannedText = plannedDays
      ? `${plannedDays} vacation days planned in ${selectedYear}`
      : `No vacation days planned in ${selectedYear}`;
    const yearlyVacationDaysText = yearlyVacationDays
      ? `${yearlyVacationDays} vacation days available per year`
      : 'No yearly vacation days defined';
    const availableVacationDaysText = (availableVacationDays || availableVacationDays === 0)
      ? `${availableVacationDays} vacation days available in ${currentYear}`
      : 'Vacation days availability unknown';
    let lines = [];
    if (selectedYear < currentYear) {
      lines.push(usedText);
    } else if (selectedYear > currentYear) {
      lines.push(plannedText);
    } else {
      lines.push(usedText, plannedText);
    }
    lines.push(yearlyVacationDaysText, availableVacationDaysText);
    return lines.join('\n');
  };

  function generateGradientStyle(dateDayTypes) {
    const style = {};

    if (dateDayTypes.length > 0) {
      // Clone to avoid mutating the original array assigned to calendar state
      const typesForGradient = [...dateDayTypes];
      // Move the "Vacation" day type to the front if it exists
      const vacationIndex = typesForGradient.findIndex(dayType => dayType.name === "Vacation");
      if (vacationIndex > -1) {
        const [vacationDayType] = typesForGradient.splice(vacationIndex, 1);
        typesForGradient.unshift(vacationDayType);
      }

      const percentagePerType = 100 / typesForGradient.length;
      const gradientParts = typesForGradient.map((dayType, index) => {
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

  const handleDrop = (e, targetTeamId) => {
    e.preventDefault();
    const {memberId, originTeamId, memberName} = draggedMember;
    if (targetTeamId !== originTeamId) {
      const confirmMove = window.confirm(`Are you sure you want to move ${memberName} to the new team?`);
      if (confirmMove) {
        moveMemberMutation.mutate(
          {memberId, sourceTeamId: originTeamId, targetTeamId},
          {
            onSuccess: () => {
              toast.success(`${memberName} moved successfully`);
              updateTeamData();
            },
            onError: (error) => {
              console.error('Failed to move team member:', error);
              toast.error('Failed to move team member');
            },
          },
        );
      }
    }
    setDropTargetId(null); // Remove highlight when the dragged item leaves the row
    setDraggedMember({memberId: null, originTeamId: null, memberName: ''}); // Reset drag state
  };

  const updateLocalTeamData = (teamId, memberId, dateStr, newDayTypes, comment) => {
    const getDayTypeById = (id) => {
      return dayTypes.find(dayType => dayType._id === id);
    };

    setTeamData(teamData => {
      return teamData.map(team => {
        if (team._id === teamId) {
          const updatedMembers = team.team_members.map(member => {
            if (member.uid === memberId) {
              return {
                ...member,
                days: {
                  ...member.days,
                  [dateStr]: {
                    day_types: newDayTypes.map(id => getDayTypeById(id)),
                    comment: comment
                  }
                }
              };
            }
            return member;
          });
          return {...team, team_members: updatedMembers};
        }
        return team;
      });
    });
  };

  const subscriptionTeam = subscriptionTeamId ? teamData.find(team => team._id === subscriptionTeamId) : null;


  return (
    <div>
      <TeamModal
        isOpen={showAddTeamForm}
        onClose={() => {
          setShowAddTeamForm(false);
          setEditingTeam(null);
          updateTeamData();
        }}
        editingTeam={editingTeam}
      />

      <MemberModal
        isOpen={showAddMemberForm}
        onClose={() => {
          setShowAddMemberForm(false);
          setEditingMember(null);
        }}
        selectedTeamId={selectedTeamId}
        updateTeamData={updateTeamData}
        editingMember={editingMember}
      />
      <MemberHistoryModal
        isOpen={showMemberHistory}
        onClose={() => setShowMemberHistory(false)}
        teamId={memberHistoryInfo.teamId}
        memberId={memberHistoryInfo.memberId}
        memberName={memberHistoryInfo.memberName}
      />
      <DeleteMemberModal
        isOpen={showDeleteMemberModal}
        memberName={memberToDelete?.member.name || ''}
        onClose={closeDeleteMemberModal}
        onConfirm={handleConfirmDeleteMember}
        isSubmitting={deleteMemberMutation.isPending}
      />
      <DayTypeContextMenu
        contextMenuRef={contextMenuRef}
        isOpen={showContextMenu}
        position={contextMenuPosition}
        onClose={() => {
          setShowContextMenu(false);
          setSelectedCells([]);
          setSelectionStart(null);
        }}
        dayTypes={dayTypes}
        selectedDayInfo={selectedDayInfo}
        teamData={teamData}
        updateTeamData={updateTeamData}
        updateLocalTeamData={updateLocalTeamData}
      />
      <TeamSubscriptionContextMenu
        contextMenuRef={subscriptionMenuRef}
        isOpen={showSubscriptionMenu}
        position={subscriptionMenuPosition}
        onClose={closeSubscriptionMenu}
        teamId={subscriptionTeamId}
        teamName={subscriptionTeam?.name || ''}
        currentUserId={user?._id}
        subscribers={subscriptionTeam?.subscribers || []}
        onPreferencesUpdated={updateTeamData}
      />

      <div className="stickyHeader">
        <div className="filter-wrapper">
          <input
            type="search"
            ref={filterInputRef}
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            placeholder="Filter by team or member name"
          />
        </div>
        <MonthSelector
          displayMonth={displayMonth}
          setDisplayMonth={setDisplayMonth}
          todayYear={todayYear}
          todayMonth={todayMonth}
        />
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
            {daysHeader.map(({day, weekday, date}, idx) => {
              const isOutOfMonth = date.getMonth() !== displayMonth.getMonth();
              const isWeekendDay = isWeekend(date);
              return (
                <th
                  key={idx}
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
          <tbody>
          {filterTeamsAndMembers(teamData).map(team => {
            const isSubscribed = team.subscribers?.some(sub => sub._id === user._id);
            const isTeamCollapsed = collapsedTeams.includes(team._id);
            const collapseIconTitle = isTeamCollapsed ? 'Expand team' : 'Collapse team';
            const isTeamFocused = focusedTeamId === team._id;
            const focusIconTitle = isTeamFocused ? 'Show all teams' : 'Focus on team';
            return (
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
                      <FontAwesomeIconWithTitle
                        icon={isTeamCollapsed ? faChevronRight : faChevronDown}
                        title={collapseIconTitle}
                        wrapperClassName="collapse-icon"
                        wrapperProps={{
                          onClick: () => toggleTeamCollapse(team._id),
                          role: 'button',
                        }}
                      />
                      <FontAwesomeIconWithTitle
                        icon={faEye}
                        title={focusIconTitle}
                        wrapperClassName={`eye-icon ${isTeamFocused ? 'eye-icon-active' : ''}`}
                        wrapperProps={{
                          onClick: () => handleFocusTeam(team._id),
                          role: 'button',
                        }}
                      />
                      {team.name}
                      <span className="team-member-count">({team.team_members.length})</span>
                      <span className="add-icon" onClick={() => handleAddMemberIconClick(team._id)}
                            title="Add team member">➕</span>
                      <FontAwesomeIconWithTitle
                        icon={isSubscribed ? faSolidBell : faRegularBell}
                        title="Manage team subscription"
                        wrapperClassName={`watch-icon ${isSubscribed ? 'watch-icon-active' : ''}`}
                        wrapperProps={{
                          onClick: (event) => openSubscriptionMenu(event, team._id),
                          role: 'button',
                        }}
                      />
                      <FontAwesomeIconWithTitle
                        icon={faEdit}
                        title="Edit team"
                        wrapperClassName="edit-icon"
                        wrapperProps={{
                          onClick: () => handleEditTeamClick(team._id),
                          role: 'button',
                        }}
                      />
                      <FontAwesomeIconWithTitle
                        icon={faLink}
                        title="Copy calendar feed link"
                        wrapperClassName="calendar-link-icon"
                        wrapperProps={{
                          onClick: () => handleCopyCalendarLink(team._id),
                          role: 'button',
                        }}
                      />
                      {team.team_members.length === 0 && (
                        <FontAwesomeIconWithTitle
                          icon={faTrashAlt}
                          title="Delete team"
                          wrapperClassName="delete-icon"
                          wrapperProps={{
                            onClick: () => deleteTeam(team._id),
                            role: 'button',
                          }}
                        />
                      )}
                    </td>
                    {daysHeader.map(({date}, idx) => {
                      return (<td
                        key={idx}
                        className={`${isToday(date) ? 'current-day' : (isYesterday(date) ? 'yesterday' : '')}`}
                      >


                      </td>)
                    })}
                  </tr>
                  {!collapsedTeams.includes(team._id) && team.team_members.map(member => (
                    <tr key={member.uid} className={draggingMemberId === member.uid ? 'dragging' : ''}>
                      <td className="member-name-cell">
                        {member.name} <span title={member.country}>{member.country_flag}</span>
                        <FontAwesomeIconWithTitle
                          icon={faInfoCircle}
                          title={renderVacationDaysTooltip(member)}
                          wrapperClassName="info-icon"
                        />
                        <FontAwesomeIconWithTitle
                          icon={faHistory}
                          title="View history"
                          wrapperClassName="history-icon"
                          wrapperProps={{
                            onClick: () => openMemberHistory(team._id, member),
                            role: 'button',
                          }}
                        />
                        <FontAwesomeIconWithTitle
                          icon={faGripVertical}
                          title="Move to another team"
                          wrapperClassName="drag-icon"
                          wrapperProps={{
                            draggable: true,
                            onDragStart: (e) => handleDragStart(e, team._id, member.uid, member.name),
                            onDragEnd: handleDragEnd,
                          }}
                        />
                        <FontAwesomeIconWithTitle
                          icon={faEdit}
                          title="Edit member"
                          wrapperClassName="edit-icon"
                          wrapperProps={{
                            onClick: () => handleEditMemberClick(team._id, member.uid),
                            role: 'button',
                          }}
                        />
                        {canManageMembers && (
                          <FontAwesomeIconWithTitle
                            icon={faTrashAlt}
                            title="Delete member"
                            wrapperClassName="delete-icon"
                            wrapperProps={{
                              onClick: () => openDeleteMemberModal(team._id, member.uid),
                              role: 'button',
                            }}
                          />
                        )}
                      </td>
                      {daysHeader.map(({date}, idx) => {
                        const dayEntry = getMemberDayEntry(member, date);
                        const dateDayTypes = dayEntry?.day_types || [];
                        const isHolidayDay = isHoliday(member.country, date);
                        const hasComment = dayEntry?.comment && dayEntry.comment.trim().length > 0;

                        const cellClassNames = [
                          'clickable-cell',
                          isHolidayDay ? 'holiday-cell' : '',
                          isWeekend(date) ? 'weekend-cell' : '',
                          isToday(date) ? 'current-day' : (isYesterday(date) ? 'yesterday' : ''),
                          selectedCells.some((cell) => cell.date.getTime() === date.getTime() && cell.memberId === member.uid)
                            ? 'selected-range'
                            : '',
                        ].filter(Boolean).join(' ');

                        return (
                          <td
                            key={idx}
                            onMouseDown={() => handleMouseDown(team._id, member.uid, date, isSelectableDay(member, date))}
                            onMouseOver={() => handleMouseOver(team._id, member.uid, date, member)}
                            onMouseUp={handleMouseUp}
                            onClick={(e) => handleDayClick(team._id, member.uid, date, isHolidayDay, e)}
                            title={getCellTitle(member, date)}
                            className={cellClassNames}
                            style={generateGradientStyle(dateDayTypes)}
                          >
                            <div className="day-cell-content">
                              {hasComment && <span className="comment-icon">*</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              )}
            </React.Fragment>
            );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CalendarComponent;
