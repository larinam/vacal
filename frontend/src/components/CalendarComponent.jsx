import React from 'react';

const CalendarComponent = ({ teamData, holidays, currentMonth }) => {
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const daysHeader = Array.from({ length: daysInMonth }, (_, i) => i + 1); // [1, 2, ..., 30/31]

    const isVacationDay = (vacDays, day) => {
        const formattedDay = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return vacDays.some(vd => vd.startsWith(formattedDay));
    };

    return (
        <table>
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
                            <td>{team.name}</td>
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
    );
};

export default CalendarComponent;
