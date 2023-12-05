import React, { useState } from 'react';
import './styles.css';

const API_URL = process.env.REACT_APP_API_URL;

const CalendarComponent = ({ teamData, holidays, updateTeamData }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const daysHeader = Array.from({ length: daysInMonth }, (_, i) => i + 1); // [1, 2, ..., 30/31]

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

    const getCellClassName = (member, day) => {
        if (isVacationDay(member.vac_days, day)) {
            return 'vacation-cell'; // Apply vacation styling
        } else if (isHoliday(member.country, day)) {
            return 'holiday-cell'; // Apply holiday styling
        }
        return '';
    };

    const handleDayClick = async (teamId, memberId, day) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const formattedDate = formatDate(date);
        const member = teamData.find(team => team._id === teamId).team_members.find(member => member.uid === memberId);

        if (isVacationDay(member.vac_days, day)) {
            // It's a vacation day, send DELETE request
            if (window.confirm(`Remove ${formattedDate} from vacation days?`)) {
                try {
                    const response = await fetch(API_URL+`/teams/${teamId}/members/${memberId}/vac_days/`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                        },
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
            // It's not a vacation day, send PUT request
            if (window.confirm(`Mark ${formattedDate} as a vacation day?`)) {
                try {
                    const response = await fetch(API_URL+`/teams/${teamId}/members/${memberId}/vac_days/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
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

    return (
        <div>
            <div>
                <button onClick={() => changeMonth(-1)}>&lt; Prev</button>
                <span>{currentMonth.toLocaleString('default', { month: 'long' })} {currentMonth.getFullYear()}</span>
                <button onClick={() => changeMonth(1)}>Next &gt;</button>
            </div>
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
                    {teamData.map(team => (
                        <React.Fragment key={team.id}>
                            <tr>
                                <td className="team-name-cell">{team.name}</td>
                                {daysHeader.map(day => <td key={day}></td>)} {/* Empty cells for team row */}
                            </tr>
                            {team.team_members.map(member => (
                                <tr key={member.uid}>
                                    <td>{member.name}</td>
                                    {daysHeader.map(day => (
                                        <td key={day} onClick={() => handleDayClick(team._id, member.uid, day)} className={getCellClassName(member, day)}>
                                            {/* Add content or styling for vacation day */}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CalendarComponent;