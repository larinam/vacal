import React, { useState, useEffect, useRef } from 'react';
import './DateTypeModal.css';

const API_URL = process.env.REACT_APP_API_URL;
const DayTypeModal = ({ isOpen, onClose, dayTypes, selectedDayInfo, updateTeamData, authHeader }) => {
    const [selectedDayTypes, setSelectedDayTypes] = useState([]);
    const modalContentRef = useRef(null);
    const formRef = useRef(null);

    useEffect(() => {
        // Check if existingDayTypes is an array and transform it to an array of _id values
        const dayTypeIds = selectedDayInfo?.existingDayTypes
            ? selectedDayInfo.existingDayTypes.map(type => type._id)
            : [];
    
        setSelectedDayTypes(dayTypeIds);
    }, [isOpen, selectedDayInfo]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalContentRef.current && !modalContentRef.current.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            } else if (event.key === 'Enter' && formRef.current) {
                event.preventDefault();
                formRef.current.requestSubmit();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const handleCheckboxChange = (e) => {
        const checked = e.target.checked;
        const value = e.target.value;
        setSelectedDayTypes(prev => 
            checked ? [...prev, value] : prev.filter(type => type !== value)
        );
    };

    const getHeaders = () => {
        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }
        return headers;
    };

    const formatDate = (date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Format data according to the API specification
        const dateStr = formatDate(selectedDayInfo.date);
        let dayTypeData = {[dateStr] : selectedDayTypes};
    
        const url = `${API_URL}/teams/${selectedDayInfo.teamId}/members/${selectedDayInfo.memberId}/days`;
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(dayTypeData),
            });
    
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            onClose();
            updateTeamData();
        } catch (error) {
            console.error('Error updating day types:', error);
        }
    };
    

    if (!isOpen) return null;

    return (
        <div className="modal">
            <div className="modal-content" ref={modalContentRef}>
                <form onSubmit={handleSubmit} ref={formRef}>
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
                    <div className="button-container">
                        <button type="submit">Save</button>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DayTypeModal;
