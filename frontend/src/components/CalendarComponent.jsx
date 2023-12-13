import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faEye } from '@fortawesome/free-solid-svg-icons';
import './CalendarComponent.css';

const API_URL = process.env.REACT_APP_API_URL;

const CalendarComponent = ({ teamData, holidays, updateTeamData, authHeader }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [newTeamName, setNewTeamName] = useState('');
    const [showAddMemberForm, setShowAddMemberForm] = useState(false);
    const addMemberFormRef = useRef(null);
    const stickyHeaderHeight = 44;
    const [newMemberData, setNewMemberData] = useState({ name: '', country: '', vac_days: [] });
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [collapsedTeams, setCollapsedTeams] = useState([]);
    const [focusedTeamId, setFocusedTeamId] = useState(null);
    const [filterInput, setFilterInput] = useState('');
    const filterInputRef = useRef(null);

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
        filterInputRef.current.focus()
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
        const memberName = teamData.find(team => team._id === teamId).team_members.find(member => member.uid === memberId).name;
        if (window.confirm(`Are you sure you want to delete the team member '${memberName}'?`)) {
            try {
                const response = await fetch(API_URL + `/teams/${teamId}/members/${memberId}`, {
                    method: 'DELETE',
                    headers: getHeaders(),
                });
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                updateTeamData(); // Refresh data
            } catch (error) {
                console.error('Error deleting team member:', error);
            }
        }
    };

    const handleAddTeam = async (e) => {
        e.preventDefault(); // Prevents the default form submit action

        try {
            const response = await fetch(API_URL + '/teams/', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ name: newTeamName }),
            });

            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            setNewTeamName(''); // Reset input field
            updateTeamData(); // Refresh data
        } catch (error) {
            console.error('Error adding team:', error);
        }
    };

    const handleAddMemberIconClick = (teamId) => {
        setShowAddMemberForm(true);
        setSelectedTeamId(teamId);
        setNewMemberData({ ...newMemberData, vac_days: [] }); // Reset form data
    };

    const handleAddMemberFormSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(API_URL + `/teams/${selectedTeamId}/members/`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(newMemberData),
            });

            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            setNewMemberData({ name: '', country: '', vac_days: [] }); // Reset form data after successful submission
            setShowAddMemberForm(false); // Hide form after successful addition
            updateTeamData(); // Refresh data
        } catch (error) {
            console.error('Error adding team member:', error);
        }
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

    return (
        <div>
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
            </div>
            <div className="contentBelowStickyHeader">
                {showAddMemberForm && (
                    <form ref={addMemberFormRef} onSubmit={handleAddMemberFormSubmit}>
                        <input
                            type="text"
                            value={newMemberData.name}
                            onChange={(e) => setNewMemberData({ ...newMemberData, name: e.target.value })}
                            placeholder="Enter member's name"
                            required
                        />
                        <input
                            type="text"
                            value={newMemberData.country}
                            onChange={(e) => setNewMemberData({ ...newMemberData, country: e.target.value })}
                            placeholder="Enter member's country"
                            required
                        />
                        {/* Add input fields for vacation days if needed */}
                        <button type="submit">Add Member</button>
                    </form>
                )}
                <table className="calendar-table">
                    <colgroup>
                        <col /> {/* This col is for the non-date column */}
                        {daysHeader.map((day, idx) => (
                            <col key={idx} className={isWeekend(day) ? 'weekend-column' : ''} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Team / Member</th>
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
                                                    onClick={() => setFocusedTeamId(team._id === focusedTeamId ? null : team._id)}>
                                                    <FontAwesomeIcon icon={faEye} />
                                                </span>
                                                {team.name}
                                                {team.team_members.length === 0 && (
                                                    <span className="delete-icon" onClick={() => deleteTeam(team._id)}>🗑️</span>
                                                )}
                                                <span className="add-icon" onClick={() => handleAddMemberIconClick(team._id)} title="Add team member">➕</span>
                                            </td>
                                            {daysHeader.map(day => <td key={day}></td>)} {/* Empty cells for team row */}
                                        </tr>
                                        {!collapsedTeams.includes(team._id) && team.team_members.map(member => (
                                            <tr key={member.uid}>
                                                <td>
                                                    {member.name}
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

                <form onSubmit={handleAddTeam}>
                    <input
                        type="text"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="Enter team name"
                        required
                    />
                    <button type="submit">Add Team</button>
                </form>
            </div>
        </div>
    );
};

export default CalendarComponent;