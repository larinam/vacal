import React, { useState, useEffect } from 'react';
import './DayTypeContextMenu.css';
import { useApi } from '../hooks/useApi';

const DayTypeContextMenu = ({ contextMenuRef, isOpen, position, onClose, dayTypes, selectedDayInfo, updateTeamData, updateLocalTeamData }) => {
    const [selectedDayTypes, setSelectedDayTypes] = useState([]);
    const { apiCall } = useApi();

    useEffect(() => {
        if (selectedDayInfo?.existingDayTypes) {
            const dayTypeIds = selectedDayInfo.existingDayTypes.map(type => type._id);
            setSelectedDayTypes(dayTypeIds);
        }
    }, [isOpen, selectedDayInfo]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    const handleCheckboxChange = async (e) => {
        const checked = e.target.checked;
        const value = e.target.value;
        const updatedDayTypes = checked
            ? [...selectedDayTypes, value]
            : selectedDayTypes.filter(type => type !== value);

        setSelectedDayTypes(updatedDayTypes);
        updateLocalTeamData(selectedDayInfo.teamId, selectedDayInfo.memberId, formatDate(selectedDayInfo.date), updatedDayTypes);

        const dateStr = formatDate(selectedDayInfo.date);
        let dayTypeData = {[dateStr]: updatedDayTypes};

        const url = `/teams/${selectedDayInfo.teamId}/members/${selectedDayInfo.memberId}/days`;
        try {
            await apiCall(url, 'PUT', dayTypeData);
            updateTeamData();
        } catch (error) {
            console.error('Error updating day types:', error);
        }

        onClose();
    };

    const formatDate = (date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    const contextMenuStyle = {
        position: 'absolute',
        top: `${position.y}px`,
        left: `${position.x}px`,
    };

    return (
        <div className="context-menu" style={contextMenuStyle} ref={contextMenuRef}>
            <div className="close-button" onClick={onClose}>&times;</div>
            {dayTypes.map(type => (
                <div key={type._id} className="day-type-item">
                    <input
                        type="checkbox"
                        id={`dayType-${type._id}`}
                        value={type._id}
                        onChange={handleCheckboxChange}
                        checked={selectedDayTypes.includes(type._id)}
                    />
                    <label htmlFor={`dayType-${type._id}`}>
                        <span className="color-indicator" style={{ backgroundColor: type.color }}></span>
                        {type.name}
                    </label>
                </div>
            ))}
        </div>
    );
};

export default DayTypeContextMenu;
