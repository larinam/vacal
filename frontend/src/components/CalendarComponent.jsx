import React, { useState } from 'react';
import './styles.css';

const CalendarComponent = ({ teamData, holidays }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const daysHeader = Array.from({ length: daysInMonth }, (_, i) => i + 1); // [1, 2, ..., 30/31]

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
                                        <td key={day} style={{ backgroundColor: isVacationDay(member.vac_days, day) ? 'green' : 'transparent' }}>
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