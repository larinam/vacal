import React, {useEffect, useMemo, useRef, useState} from 'react';
import {toast} from 'react-toastify';
import './calendar/calendar.css';
import TeamModal from './TeamModal';
import MemberModal from './MemberModal';
import DayTypeContextMenu from './DayTypeContextMenu';
import TeamSubscriptionContextMenu from './TeamSubscriptionContextMenu';
import {MemberHistoryModal, TeamHistoryModal} from './HistoryModal';
import DeleteMemberModal from './DeleteMemberModal';
import CalendarToolbar from './calendar/CalendarToolbar';
import CalendarTableHeader from './calendar/CalendarTableHeader';
import TeamRow from './calendar/TeamRow';
import MemberRow from './calendar/MemberRow';
import {useAuth} from '../contexts/AuthContext';
import {useLocalStorage} from '../hooks/useLocalStorage';
import {API_URL} from '../utils/apiConfig';
import {buildManagerOptions, getReportsUnder} from '../utils/hierarchy';
import {
  filterTeamsByManager,
  filterTeamsByText,
  getMemberDayComment,
  getMemberDayEntry,
} from '../utils/calendar';
import useTeamManagementMutations from '../hooks/mutations/useTeamManagementMutations';
import useMemberMutations from '../hooks/mutations/useMemberMutations';
import useAnchoredMenu from '../hooks/useAnchoredMenu';
import useCalendarGrid from '../hooks/useCalendarGrid';
import useHolidayData from '../hooks/useHolidayData';
import useDaySelection from '../hooks/useDaySelection';

const CalendarComponent = ({serverTeamData, holidays, dayTypes, updateTeamData}) => {
  const {deleteTeamMutation, moveMemberMutation} = useTeamManagementMutations();
  const {deleteMemberMutation} = useMemberMutations();
  const {user} = useAuth();
  const canManageMembers = user?.role === 'manager';
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
  const [managerFilterUid, setManagerFilterUid] = useLocalStorage('vacalManagerFilter', '');
  const [reportScope, setReportScope] = useLocalStorage('vacalReportScope', 'direct');
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);
  const [showTeamHistory, setShowTeamHistory] = useState(false);
  const [teamHistoryInfo, setTeamHistoryInfo] = useState({teamId: null, teamName: ''});
  const [showMemberHistory, setShowMemberHistory] = useState(false);
  const [memberHistoryInfo, setMemberHistoryInfo] = useState({teamId: null, memberId: null, memberName: ''});
  const [showDeleteMemberModal, setShowDeleteMemberModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const dayMenu = useAnchoredMenu();
  const subscriptionMenu = useAnchoredMenu();
  const [subscriptionTeamId, setSubscriptionTeamId] = useState(null);
  const [draggedMember, setDraggedMember] = useState({memberId: null, originTeamId: null, memberName: ''});
  const [draggingMemberId, setDraggingMemberId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);

  const teamCountries = useMemo(() => {
    const countries = new Set();
    (teamData || []).forEach((team) => {
      (team?.team_members || []).forEach((member) => {
        if (member?.country) {
          countries.add(member.country);
        }
      });
    });
    return Array.from(countries);
  }, [teamData]);

  const allMembers = useMemo(
    () => (teamData || []).flatMap((team) => (team.team_members || []).filter((m) => !m.is_deleted)),
    [teamData]
  );

  // The team member that corresponds to the logged-in user (matched by email,
  // since there is no hard link between User and TeamMember). Powers the "Me" shortcut.
  const currentMemberUid = useMemo(() => {
    const email = user?.email?.toLowerCase();
    if (!email) return null;
    return allMembers.find((m) => m.email?.toLowerCase() === email)?.uid || null;
  }, [allMembers, user]);

  // Selectable roots for the manager filter: every member who manages at least
  // one other member (sorted by name), with a "Me (You)" shortcut pinned first.
  const managerSelectOptions = useMemo(() => {
    const options = buildManagerOptions(allMembers, currentMemberUid);
    if (currentMemberUid) {
      options.unshift({uid: currentMemberUid, label: 'Me (You)'});
    }
    return options;
  }, [allMembers, currentMemberUid]);

  // A persisted manager filter can outlive the member it points at (the manager
  // was deleted, or lost their last report and dropped out of the options).
  // Collapse to '' in that case so the <select>, the scope toggle and the
  // filtering all agree instead of silently showing a truncated list under an
  // "All members" label. It self-heals: if data is still loading (no options
  // yet) the persisted uid re-activates once a matching option reappears.
  const effectiveManagerUid = useMemo(
    () => (managerSelectOptions.some((o) => o.uid === managerFilterUid) ? managerFilterUid : ''),
    [managerSelectOptions, managerFilterUid]
  );

  // Set of member uids visible under the selected manager, or null when no
  // manager filter is active.
  const visibleUids = useMemo(() => {
    if (!effectiveManagerUid) return null;
    return getReportsUnder(effectiveManagerUid, allMembers, {
      includeIndirect: reportScope === 'all',
      includeRoot: true,
    });
  }, [effectiveManagerUid, allMembers, reportScope]);

  const {daysHeader, weekSpans, displayedYears} = useCalendarGrid(displayMonth);
  const {holidayData} = useHolidayData({holidays, teamCountries, displayedYears});

  const showDayContextMenu = (teamId, memberId, dates, event, isHolidayDay = false, selectionDayTypes = []) => {
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

    dayMenu.openAt(event);
  };

  const {selectedCells, handleMouseDown, handleMouseOver, handleMouseUp, clearSelection} = useDaySelection({
    teamData,
    holidayData,
    onSelectionComplete: ({teamId, memberId, dates, event, selectionDayTypes}) =>
      showDayContextMenu(teamId, memberId, dates, event, false, selectionDayTypes),
  });

  const openTeamHistory = (team) => {
    setTeamHistoryInfo({teamId: team._id, teamName: team.name});
    setShowTeamHistory(true);
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
    triggerSaveIcon();
  }, [collapsedTeams, focusedTeamId, filterInput, managerFilterUid, reportScope]);

  useEffect(() => {
    if (showAddMemberForm && addMemberFormRef.current) {
      const formPosition = addMemberFormRef.current.getBoundingClientRect().top + window.pageYOffset - stickyHeaderHeight;
      window.scrollTo({top: formPosition, behavior: 'smooth'});
    }
  }, [showAddMemberForm]);

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

  const handleConfirmDeleteMember = ({lastWorkingDay, separationType}) => {
    if (!memberToDelete) {
      return;
    }

    const {teamId, member} = memberToDelete;

    const params = new URLSearchParams({
      last_working_day: lastWorkingDay,
    });

    if (separationType) {
      params.set('separation_type', separationType);
    }

    deleteMemberMutation.mutate(
      {
        endpoint: `/teams/${teamId}/members/${member.uid}?${params.toString()}`,
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
    const link = `${API_URL}/teams/calendar/${teamId}?user_api_key=${user?.auth_details?.api_key}`;
    navigator.clipboard.writeText(link).then(() => {
      toast.success('Calendar link copied');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  const openSubscriptionMenu = (event, teamId) => {
    event.stopPropagation();
    setSubscriptionTeamId(teamId);
    subscriptionMenu.openAt(event);
  };

  const closeSubscriptionMenu = () => {
    subscriptionMenu.close();
    setSubscriptionTeamId(null);
  };

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

  // Filter in two memoized stages so the empty-state message can tell which
  // stage produced the empty result. Manager filtering runs first (see
  // calendar.js), so the text filter only ever narrows the manager's reports.
  const managerFilteredTeams = useMemo(
    () => filterTeamsByManager(teamData, visibleUids),
    [teamData, visibleUids]
  );
  const visibleTeams = useMemo(
    () => filterTeamsByText(managerFilteredTeams, filterInput),
    [managerFilteredTeams, filterInput]
  );

  let emptyFilterMessage = 'No teams or members match your filter.';
  if (effectiveManagerUid && managerFilteredTeams.length === 0) {
    // Only blame the manager filter when it is the stage that emptied the list;
    // otherwise the text filter is responsible and the generic message applies.
    // effectiveManagerUid is always a valid option, so the name lookup succeeds.
    const rootName = effectiveManagerUid === currentMemberUid
      ? 'you'
      : allMembers.find((m) => m.uid === effectiveManagerUid)?.name;
    if (rootName) {
      emptyFilterMessage = `No members report to ${rootName}${reportScope === 'direct' ? ' directly' : ''}.`;
    }
  }


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
        allMembers={allMembers}
      />
      <TeamHistoryModal
        isOpen={showTeamHistory}
        onClose={() => setShowTeamHistory(false)}
        teamId={teamHistoryInfo.teamId}
        teamName={teamHistoryInfo.teamName}
        teamMembers={(teamData || []).find((team) => team._id === teamHistoryInfo.teamId)?.team_members || []}
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
        contextMenuRef={dayMenu.ref}
        isOpen={dayMenu.isOpen}
        position={dayMenu.position}
        onClose={() => {
          dayMenu.close();
          clearSelection();
        }}
        dayTypes={dayTypes}
        selectedDayInfo={selectedDayInfo}
        teamData={teamData}
        updateTeamData={updateTeamData}
        updateLocalTeamData={updateLocalTeamData}
      />
      <TeamSubscriptionContextMenu
        contextMenuRef={subscriptionMenu.ref}
        isOpen={subscriptionMenu.isOpen}
        position={subscriptionMenu.position}
        onClose={closeSubscriptionMenu}
        teamId={subscriptionTeamId}
        teamName={subscriptionTeam?.name || ''}
        currentUserId={user?._id}
        subscribers={subscriptionTeam?.subscribers || []}
        onPreferencesUpdated={updateTeamData}
      />

      <CalendarToolbar
        filterInput={filterInput}
        onFilterInputChange={setFilterInput}
        managerFilterUid={effectiveManagerUid}
        onManagerFilterChange={setManagerFilterUid}
        managerSelectOptions={managerSelectOptions}
        reportScope={reportScope}
        onReportScopeChange={setReportScope}
        displayMonth={displayMonth}
        setDisplayMonth={setDisplayMonth}
        todayYear={todayYear}
        todayMonth={todayMonth}
        showSaveIcon={showSaveIcon}
      />
      <div className="contentBelowStickyHeader">
        <table className="calendar-table">
          <CalendarTableHeader
            daysHeader={daysHeader}
            weekSpans={weekSpans}
            displayMonth={displayMonth}
            onAddTeamClick={handleAddTeamIconClick}
          />
          <tbody>
          {visibleTeams.map((team) => (
            <React.Fragment key={team._id}>
              {(!focusedTeamId || focusedTeamId === team._id) && (
                <>
                  <TeamRow
                    team={team}
                    daysHeader={daysHeader}
                    isCollapsed={collapsedTeams.includes(team._id)}
                    isFocused={focusedTeamId === team._id}
                    isSubscribed={team.subscribers?.some(sub => sub._id === user?._id)}
                    isDropTarget={dropTargetId === team._id}
                    onToggleCollapse={toggleTeamCollapse}
                    onFocusTeam={handleFocusTeam}
                    onAddMember={handleAddMemberIconClick}
                    onOpenSubscriptionMenu={openSubscriptionMenu}
                    onOpenHistory={openTeamHistory}
                    onEditTeam={handleEditTeamClick}
                    onCopyCalendarLink={handleCopyCalendarLink}
                    onDeleteTeam={deleteTeam}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  />
                  {!collapsedTeams.includes(team._id) && team.team_members.map((member) => (
                    <MemberRow
                      key={member.uid}
                      team={team}
                      member={member}
                      daysHeader={daysHeader}
                      holidayData={holidayData}
                      selectedCells={selectedCells}
                      isDragging={draggingMemberId === member.uid}
                      canManageMembers={canManageMembers}
                      displayYear={displayMonth.getFullYear()}
                      onOpenHistory={openMemberHistory}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onEditMember={handleEditMemberClick}
                      onDeleteMember={openDeleteMemberModal}
                      onDayMouseDown={handleMouseDown}
                      onDayMouseOver={handleMouseOver}
                      onDayMouseUp={handleMouseUp}
                      onDayClick={handleDayClick}
                    />
                  ))}
                </>
              )}
            </React.Fragment>
          ))}
          {visibleTeams.length === 0 && (
            <tr>
              <td colSpan={daysHeader.length + 1} className="empty-filter-message">
                {emptyFilterMessage}
              </td>
            </tr>
          )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CalendarComponent;
