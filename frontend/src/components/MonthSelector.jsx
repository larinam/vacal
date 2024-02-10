import React, { useEffect } from 'react';
import './MonthSelector.css';

const MonthSelector = ({ displayMonth, setDisplayMonth, todayYear, todayMonth }) => {
    const changeMonth = (offset) => {
        const newMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + offset, 1);
        setDisplayMonth(newMonth);
    };

    useEffect(() => {
        const handleKeyDown = (event) => {
            const focusWithinInteractive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable;

            // If not within an input or textarea, or editable area then check for arrow keys
            if (!focusWithinInteractive) {
                if (event.key === 'ArrowLeft') {
                    changeMonth(-1);
                } else if (event.key === 'ArrowRight') {
                    changeMonth(1);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Cleanup to remove the event listener
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [displayMonth, setDisplayMonth]);

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
