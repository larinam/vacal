import React from 'react';
import './MonthSelector.css';

const MonthSelector = ({ displayMonth, setDisplayMonth, todayYear, todayMonth }) => {
    const changeMonth = (offset) => {
        const newMonth = new Date(displayMonth.setMonth(displayMonth.getMonth() + offset));
        setDisplayMonth(newMonth);
    };

    return (
        <div className="monthSelector">
            <button onClick={() => changeMonth(-1)}>&lt; Prev</button>
            <span
                className="monthDisplay"
                onClick={() => setDisplayMonth(new Date(todayYear, todayMonth))}>
                {displayMonth.toLocaleString('default', { month: 'long' })} {displayMonth.getFullYear()}
            </span>
            <button onClick={() => changeMonth(1)}>Next &gt;</button>
        </div>
    );
};

export default MonthSelector;
