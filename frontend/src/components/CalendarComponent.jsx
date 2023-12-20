import React, { useState, useRef, useEffect } from 'react';
import {Tooltip} from 'react-tooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faEye, faPencilAlt, faSave, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import './CalendarComponent.css';
import AddTeamModal from './AddTeamModal';
import AddMemberModal from './AddMemberModal';

const API_URL = process.env.REACT_APP_API_URL;

const CalendarComponent = ({ teamData, holidays, updateTeamData, authHeader }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
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

    const saveToLocalStorage = (key, value) => {
        localStorage.setItem(key, value);
        setShowSaveIcon(true);
        setTimeout(() => setShowSaveIcon(false), 2000); // Hide icon after 2 seconds
    };

    const removeFromLocalStorage = (key) => {
        localStorage.removeItem(key);
        setShowSaveIcon(true);
        setTimeout(() => setShowSaveIcon(false), 2000); // Hide icon after 2 seconds
    };

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
            window.scrollTo({ top: formPosition, behavior: 'smooth' });
        }
    }, [showAddMemberForm]);

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const daysHeader = Array.from({ length: daysInMonth }, (_, i) => i + 1); // [1, 2, ..., 30/31]

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
                return { ...team, team_members: filteredMembers };
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

    const isVacationDay = (vacDays, day) => {
        const formattedDay = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return vacDays.some(vd => vd.startsWith(formattedDay));
    };

    const changeMonth = (offset) => {
        const newMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() + offset));
        setCurrentMonth(newMonth);
    };

    const isWeekend = (day) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dayOfWeek = date.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
    };

    const isHoliday = (country, day) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day+1).toISOString().split('T')[0];
        return holidays[country] && holidays[country][date];
    };

    const getHolidayName = (country, day) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day+1).toISOString().split('T')[0];
        return holidays[country] && holidays[country][date] ? holidays[country][date] : '';
    };

    const getCellClassName = (member, day) => {
        if (isVacationDay(member.vac_days, day)) {
            return 'vacation-cell'; // Apply vacation styling
        } else if (isHoliday(member.country, day)) {
            return 'holiday-cell'; // Apply holiday styling
        }
        return '';
    };

    const getHeaders = () => {
        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }
        return headers;
    };

    const handleDayClick = async (teamId, memberId, day) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const formattedDate = formatDate(date);
        const member = teamData.find(team => team._id === teamId).team_members.find(member => member.uid === memberId);

        if (isVacationDay(member.vac_days, day)) {
            // It's a vacation day, send DELETE request
            if (window.confirm(`Remove ${formattedDate} from ${member.name}'s vacation days?`)) {
                try {
                    const response = await fetch(API_URL+`/teams/${teamId}/members/${memberId}/vac_days/`, {
                        method: 'DELETE',
                        headers: getHeaders(),
                        body: JSON.stringify([formattedDate]),
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }

                    updateTeamData(); // Update data after deletion
                } catch (error) {
                    console.error('Error removing vacation days:', error);
                }
            }
        } else {
            if (window.confirm(`Mark ${formattedDate} as a vacation day for ${member.name}?`)) {
                try {
                    const response = await fetch(API_URL+`/teams/${teamId}/members/${memberId}/vac_days/`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify([formattedDate]),
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }

                    updateTeamData(); // Update data after addition
                } catch (error) {
                    console.error('Error updating vacation days:', error);
                }
            }
        }
    };

    const deleteTeam = async (teamId) => {
        const teamName = teamData.find(team => team._id === teamId).name;
        if (window.confirm(`Are you sure you want to delete the team '${teamName}'?`)) {
            try {
                const response = await fetch(API_URL + `/teams/${teamId}`, {
                    method: 'DELETE',
                    headers: getHeaders(),
                });
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
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
                const response = await fetch(API_URL + `/teams/${teamId}/members/${memberId}`, {
                    method: 'DELETE',
                    headers: getHeaders(),
                });
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
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
        const selectedYear = currentMonth.getFullYear()
        const vacationDays = member.vacation_days_by_year[selectedYear];
        return vacationDays ? `Vacation days in ${selectedYear}: ${vacationDays}` : `No vacation days in ${selectedYear}`;
    };

    return (
        <div>
            <AddTeamModal
                isOpen={showAddTeamForm}
                onClose={() => { setShowAddTeamForm(false); setEditingTeam(null); }}
                updateTeamData={updateTeamData}
                authHeader={authHeader}
                editingTeam={editingTeam}
            />

            <AddMemberModal
                isOpen={showAddMemberForm}
                onClose={() => { setShowAddMemberForm(false); setEditingMember(null); }}
                selectedTeamId={selectedTeamId}
                updateTeamData={updateTeamData}
                authHeader={authHeader}
                editingMember={editingMember}
            />

            <div className="stickyHeader">
                <div className="monthSelector">
                    <button onClick={() => changeMonth(-1)}>&lt; Prev</button>
                    <span className="monthDisplay">{currentMonth.toLocaleString('default', { month: 'long' })} {currentMonth.getFullYear()}</span>
                    <button onClick={() => changeMonth(1)}>Next &gt;</button>
                </div>

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
                {showSaveIcon && <FontAwesomeIcon icon={faSave} className="save-icon" />}
            </div>
            <div className="contentBelowStickyHeader">
                <table className="calendar-table">
                    <colgroup>
                        <col /> {/* This col is for the non-date column */}
                        {daysHeader.map((day, idx) => (
                            <col key={idx} className={isWeekend(day) ? 'weekend-column' : ''} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            <th>
                                Team<span className="add-icon" onClick={handleAddTeamIconClick} title="Add team">➕ </span>
                                / Member
                            </th>
                            {daysHeader.map(day => <th key={day}>{day}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {filterTeamsAndMembers(teamData).map(team => (
                            <React.Fragment key={team.id}>
                                {(!focusedTeamId || focusedTeamId === team._id) && (
                                    <>
                                        <tr className="team-row">
                                            <td className="team-name-cell">
                                                <span className="collapse-icon" onClick={() => toggleTeamCollapse(team._id)}>
                                                    <FontAwesomeIcon icon={collapsedTeams.includes(team._id) ? faChevronRight : faChevronDown} />
                                                </span>
                                                <span className={`eye-icon ${focusedTeamId === team._id ? 'eye-icon-active' : ''}`}
                                                    onClick={() => handleFocusTeam(team._id)}>
                                                    <FontAwesomeIcon icon={faEye} />
                                                </span>
                                                {team.name}
                                                {team.team_members.length === 0 && (
                                                    <span className="delete-icon" onClick={() => deleteTeam(team._id)}>🗑️</span>
                                                )}
                                                <span className="add-icon" onClick={() => handleAddMemberIconClick(team._id)} title="Add team member">➕</span>
                                                <span className="edit-icon" onClick={() => handleEditTeamClick(team._id)}>
                                                    <FontAwesomeIcon icon={faPencilAlt} />
                                                </span>
                                            </td>
                                            {daysHeader.map(day => <td key={day}></td>)} {/* Empty cells for team row */}
                                        </tr>
                                        {!collapsedTeams.includes(team._id) && team.team_members.map(member => (
                                            <tr key={member.uid}>
                                                <td className="member-name-cell">
                                                    {member.name}
                                                    <span className="info-icon" data-tip data-tooltip-id={`tooltip-${member.uid}`}>
                                                        <FontAwesomeIcon icon={faInfoCircle} />
                                                    </span>
                                                    <Tooltip id={`tooltip-${member.uid}`} place="top" effect="solid">
                                                        {renderVacationDaysTooltip(member)}
                                                    </Tooltip>
                                                    <span className="edit-icon" onClick={() => handleEditMemberClick(team._id, member.uid)}>
                                                        <FontAwesomeIcon icon={faPencilAlt} />
                                                    </span>
                                                    <span className="delete-icon" onClick={() => deleteTeamMember(team._id, member.uid)}>🗑️</span>
                                                </td>
                                                {daysHeader.map(day => (
                                                    <td key={day} onClick={() => handleDayClick(team._id, member.uid, day)} className={getCellClassName(member, day)} title={getHolidayName(member.country, day)}>
                                                        {/* Add content or styling for vacation day */}
                                                    </td>
                                                ))}
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