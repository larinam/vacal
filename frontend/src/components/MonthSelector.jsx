import React, { useEffect } from 'react';
import './MonthSelector.css';

const MonthSelector = ({ displayMonth, setDisplayMonth, todayYear, todayMonth }) => {
    const changeMonth = (offset) => {
        const newMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + offset, 1);
        setDisplayMonth(newMonth);
    };

    const goToToday = () => setDisplayMonth(new Date(todayYear, todayMonth));
    const isCurrentMonth =
        displayMonth.getFullYear() === todayYear && displayMonth.getMonth() === todayMonth;

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
            {/* Grouped nav with a fixed-width label so the arrows stay put across
                clicks — rapid month switching never makes the buttons move. */}
            <div className="monthNav" role="group" aria-label="Change month">
                <button type="button" className="monthNav-arrow" onClick={() => changeMonth(-1)} aria-label="Previous month">
                    <span aria-hidden="true">&lsaquo;</span>
                </button>
                <span className="monthDisplay">
                    {displayMonth.toLocaleString('default', { month: 'long' })} {displayMonth.getFullYear()}
                </span>
                <button type="button" className="monthNav-arrow" onClick={() => changeMonth(1)} aria-label="Next month">
                    <span aria-hidden="true">&rsaquo;</span>
                </button>
            </div>
            <button type="button" className="today-btn" onClick={goToToday} disabled={isCurrentMonth}>
                Today
            </button>
        </div>
    );
};

export default MonthSelector;
