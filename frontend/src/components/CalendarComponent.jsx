import {eachDayOfInterval, endOfWeek, format, getISOWeek, isToday, isWeekend, isYesterday, startOfWeek} from 'date-fns';
import React, {useCallback, useEffect, useRef, useState} from 'react';
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
import MemberHistoryModal from './MemberHistoryModal';
import TeamSubscriptionMenu from './TeamSubscriptionMenu';
import {useApi} from '../hooks/useApi';
import {useAuth} from '../contexts/AuthContext';
import {formatNotificationTopicLabel, useTeamSubscription} from '../hooks/useTeamSubscription';
import {useLocalStorage} from '../hooks/useLocalStorage';

const CalendarComponent = ({serverTeamData, holidays, dayTypes, updateTeamData}) => {
  const {apiCall} = useApi();
  const {user} = useAuth();
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
  const [collapsedTeams, setCollapsedTeams] = useLocalStorage('collapsedTeams', []);
  const [focusedTeamId, setFocusedTeamId] = useLocalStorage('focusedTeamId', null);
  const [filterInput, setFilterInput] = useLocalStorage('vacalFilter', '');
  const filterInputRef = useRef(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);
  const [showMemberHistory, setShowMemberHistory] = useState(false);
  const [memberHistoryInfo, setMemberHistoryInfo] = useState({teamId: null, memberId: null, memberName: ''});
  const contextMenuRef = useRef(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({x: 0, y: 0});
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [draggedMember, setDraggedMember] = useState({memberId: null, originTeamId: null, memberName: ''});
  const [draggingMemberId, setDraggingMemberId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [daysHeader, setDaysHeader] = useState([]);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectedCells, setSelectedCells] = useState([]);
  const [selectionDayTypes, setSelectionDayTypes] = useState([]);
  const subscriptionMenuRef = useRef(null);
  const [showSubscriptionMenu, setShowSubscriptionMenu] = useState(false);
  const [subscriptionMenuPosition, setSubscriptionMenuPosition] = useState({x: 0, y: 0});
  const [subscriptionMenuTeamId, setSubscriptionMenuTeamId] = useState(null);
  const [subscriptionMenuTopics, setSubscriptionMenuTopics] = useState([]);

  const {notificationTopics, isLoadingTopics, updateTeamSubscription} = useTeamSubscription();

  const isSubset = (subset = [], superset = []) =>
    subset.every((val) => superset.includes(val));

  const arraysEqual = (arrA = [], arrB = []) => {
    if (arrA.length !== arrB.length) {
      return false;
    }
    const sortedA = [...arrA].sort();
    const sortedB = [...arrB].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  };

  const getUserSubscriptionForTeam = useCallback((team) => {
    if (!team?.subscriptions) {
      return null;
    }
    return team.subscriptions.find((subscription) => subscription?.user?._id === user._id) || null;
  }, [user?._id]);

  const applyLocalSubscriptionUpdate = (teamId, topics) => {
    setTeamData((prevTeams = []) => prevTeams.map((team) => {
      const currentTeamId = team?._id || team?.id;
      if (currentTeamId !== teamId) {
        return team;
      }

      const existingSubscriptions = team.subscriptions || [];
      const remainingSubscriptions = existingSubscriptions.filter((subscription) => subscription?.user?._id !== user._id);
      const remainingSubscribers = (team.subscribers || []).filter((subscriber) => subscriber?._id !== user._id);

      if (!topics.length) {
        return {
          ...team,
          subscriptions: remainingSubscriptions,
          subscribers: remainingSubscribers,
        };
      }

      const existingSubscription = existingSubscriptions.find((subscription) => subscription?.user?._id === user._id);
      const userInfo = existingSubscription?.user || {
        _id: user._id,
        name: user.name,
        email: user.email,
      };

      const updatedSubscription = {
        ...existingSubscription,
        user: userInfo,
        topics,
      };

      return {
        ...team,
        subscriptions: [...remainingSubscriptions, updatedSubscription],
        subscribers: [...remainingSubscribers, userInfo],
      };
    }));
  };

  const closeSubscriptionMenu = useCallback(() => {
    setShowSubscriptionMenu(false);
    setSubscriptionMenuTeamId(null);
  }, []);

  const isSelectableDay = (member, date, baseTypes = []) => {
    const dateStr = formatDate(date);
    const dayEntry = member.days[dateStr];
    const dayTypeIds = (dayEntry?.day_types || []).map(dt => dt._id);

    if (baseTypes.length > 0) {
      return isSubset(baseTypes, dayTypeIds);
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
      const dateStr = formatDate(dates[0]);
      const dayEntry = member.days[dateStr] || {};
      existingDayTypes = dayEntry?.day_types || [];
      existingComment = dayEntry?.comment || '';
    } else if (selectionDayTypes.length > 0) {
      existingDayTypes = dayTypes.filter(dt => selectionDayTypes.includes(dt._id));
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
    const dateStr = formatDate(date);
    const dayEntry = member.days[dateStr] || {};
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

  useEffect(() => {
    if (!showSubscriptionMenu) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeSubscriptionMenu();
      }
    };

    const handleMouseDown = (event) => {
      if (subscriptionMenuRef.current && !subscriptionMenuRef.current.contains(event.target)) {
        closeSubscriptionMenu();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [showSubscriptionMenu, closeSubscriptionMenu]);

  useEffect(() => {
    if (showSubscriptionMenu && subscriptionMenuRef.current) {
      const menuWidth = subscriptionMenuRef.current.offsetWidth;
      const menuHeight = subscriptionMenuRef.current.offsetHeight;
      let adjustedX = subscriptionMenuPosition.x;
      let adjustedY = subscriptionMenuPosition.y;

      if (adjustedX - window.scrollX + menuWidth > window.innerWidth) {
        adjustedX = Math.max(window.scrollX, adjustedX - menuWidth);
      }

      if (adjustedY - window.scrollY + menuHeight > window.innerHeight) {
        adjustedY = Math.max(window.scrollY, adjustedY - menuHeight);
      }

      if (adjustedX !== subscriptionMenuPosition.x || adjustedY !== subscriptionMenuPosition.y) {
        setSubscriptionMenuPosition({x: adjustedX, y: adjustedY});
      }
    }
  }, [showSubscriptionMenu, subscriptionMenuPosition]);

  useEffect(() => {
    if (!showSubscriptionMenu || !subscriptionMenuTeamId) {
      return;
    }

    const team = teamData.find((currentTeam) => (currentTeam?._id || currentTeam?.id) === subscriptionMenuTeamId);
    if (!team) {
      return;
    }

    const subscription = getUserSubscriptionForTeam(team) || {topics: []};
    const topics = subscription.topics || [];

    if (!arraysEqual(topics, subscriptionMenuTopics)) {
      setSubscriptionMenuTopics(topics);
    }
  }, [teamData, showSubscriptionMenu, subscriptionMenuTeamId, getUserSubscriptionForTeam, subscriptionMenuTopics]);

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

  const notificationTopicsWithLabels = (notificationTopics || []).map((topic) => ({
    value: topic,
    label: formatNotificationTopicLabel(topic),
  }));

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
    const dayEntry = member.days[dateStr] || {};
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

  const handleCopyCalendarLink = (teamId) => {
    const link = `${process.env.REACT_APP_API_URL}/teams/calendar/${teamId}?user_api_key=${user.auth_details.api_key}`;
    navigator.clipboard.writeText(link).then(() => {
      toast.success('Calendar link copied');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  const openTeamSubscriptionMenu = (team, event) => {
    event.stopPropagation();
    if (event.type === 'click') {
      event.preventDefault();
    }

    const teamId = team?._id || team?.id;
    if (!teamId) {
      return;
    }

    if (showSubscriptionMenu && subscriptionMenuTeamId === teamId) {
      closeSubscriptionMenu();
      return;
    }

    const subscription = getUserSubscriptionForTeam(team) || {topics: []};
    const xPosition = event.clientX + window.scrollX;
    const yPosition = event.clientY + window.scrollY;

    setSubscriptionMenuTopics(subscription.topics || []);
    setSubscriptionMenuTeamId(teamId);
    setSubscriptionMenuPosition({x: xPosition, y: yPosition});
    setShowSubscriptionMenu(true);
  };

  const handleSubscriptionTopicToggle = async (topic, checked) => {
    if (!subscriptionMenuTeamId) {
      return;
    }

    const previousTopics = subscriptionMenuTopics;
    const updatedTopics = checked
      ? Array.from(new Set([...subscriptionMenuTopics, topic]))
      : subscriptionMenuTopics.filter((value) => value !== topic);

    setSubscriptionMenuTopics(updatedTopics);

    try {
      await updateTeamSubscription(subscriptionMenuTeamId, updatedTopics);
      applyLocalSubscriptionUpdate(subscriptionMenuTeamId, updatedTopics);
      try {
        await updateTeamData();
      } catch (refreshError) {
        console.error('Failed to refresh team data after updating notification topics:', refreshError);
      }
    } catch (error) {
      console.error('Failed to update notification topics:', error);
      toast.error('Failed to update notification preferences.');
      setSubscriptionMenuTopics(previousTopics);
    }
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
          await apiCall(`/teams/move-member/${memberId}`, 'POST', {
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

      <TeamSubscriptionMenu
        contextMenuRef={subscriptionMenuRef}
        isOpen={showSubscriptionMenu}
        position={subscriptionMenuPosition}
        onClose={closeSubscriptionMenu}
        topics={notificationTopicsWithLabels}
        selectedTopics={subscriptionMenuTopics}
        onToggleTopic={handleSubscriptionTopicToggle}
        isLoading={isLoadingTopics}
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
            {daysHeader.map(({day, date}, idx) => {
              const isOutOfMonth = date.getMonth() !== displayMonth.getMonth();
              return (
                <th
                  key={idx}
                  className={`${
                    isToday(date)
                      ? 'current-day-number'
                      : isOutOfMonth
                        ? 'out-of-month-day-number' // Assign a different class for out-of-month days
                        : 'day-number-header'
                  } ${isYesterday(date) ? 'yesterday' : ''}`}
                >
                  {day}
                </th>
              );
            })}
          </tr>
          </thead>
          <tbody>
        {filterTeamsAndMembers(teamData).map(team => {
            const subscription = getUserSubscriptionForTeam(team);
            const isSubscribed = (subscription?.topics || []).length > 0;
            return (
            <React.Fragment key={team.id || team._id}>
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
                      <span className="team-member-count">({team.team_members.length})</span>
                      <span className="add-icon" onClick={() => handleAddMemberIconClick(team._id)}
                            title="Add team member">➕</span>
                      <span
                        className={`watch-icon ${isSubscribed ? 'watch-icon-active' : ''}`}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => openTeamSubscriptionMenu(team, event)}
                        title="Manage team notifications"
                      >
                          <FontAwesomeIcon icon={isSubscribed ? faSolidBell : faRegularBell}/>
                      </span>
                      <span className="edit-icon" onClick={() => handleEditTeamClick(team._id)}>
                          <FontAwesomeIcon icon={faEdit}/>
                      </span>
                      <span className="calendar-link-icon" onClick={() => handleCopyCalendarLink(team._id)}
                            title="Copy calendar feed link">
                          <FontAwesomeIcon icon={faLink}/>
                      </span>
                      {team.team_members.length === 0 && (
                        <span className="delete-icon" onClick={() => deleteTeam(team._id)}>
                          <FontAwesomeIcon icon={faTrashAlt}/>
                        </span>
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
                        <span className="info-icon">
                            <FontAwesomeIcon icon={faInfoCircle} title={renderVacationDaysTooltip(member)}/>
                        </span>
                        <span className="history-icon" onClick={() => openMemberHistory(team._id, member)} title="View history">
                          <FontAwesomeIcon icon={faHistory}/>
                        </span>
                        <span
                          className="drag-icon"
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, team._id, member.uid, member.name)}
                          onDragEnd={handleDragEnd}
                          title="Drag and drop">
                              <FontAwesomeIcon icon={faGripVertical}/>
                          </span>
                        <span className="edit-icon" onClick={() => handleEditMemberClick(team._id, member.uid)}>
                            <FontAwesomeIcon icon={faEdit}/>
                        </span>
                        <span className="delete-icon" onClick={() => deleteTeamMember(team._id, member.uid)}>
                          <FontAwesomeIcon icon={faTrashAlt}/>
                        </span>
                      </td>
                      {daysHeader.map(({date}, idx) => {
                        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        const dayEntry = member.days[dateStr] || {};
                        const dateDayTypes = dayEntry?.day_types || [];
                        const isHolidayDay = isHoliday(member.country, date);
                        const hasComment = dayEntry?.comment && dayEntry.comment.trim().length > 0;

                        return (
                          <td
                            key={idx}
                            onMouseDown={() => handleMouseDown(team._id, member.uid, date, isSelectableDay(member, date))}
                            onMouseOver={() => handleMouseOver(team._id, member.uid, date, member)}
                            onMouseUp={handleMouseUp}
                            onClick={(e) => handleDayClick(team._id, member.uid, date, isHolidayDay, e)}
                            title={getCellTitle(member, date)}
                            className={`
    ${isHolidayDay ? 'holiday-cell' : ''}
    ${isToday(date) ? 'current-day' : (isYesterday(date) ? 'yesterday' : '')}
    ${selectedCells.some((cell) => cell.date.getTime() === date.getTime() && cell.memberId === member.uid) ? 'selected-range' : ''}
  `}
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
