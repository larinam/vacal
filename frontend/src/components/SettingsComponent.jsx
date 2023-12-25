import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt, faEdit } from '@fortawesome/free-solid-svg-icons';
import './SettingsComponent.css'; // Import the CSS for the SettingsComponent

const API_URL = process.env.REACT_APP_API_URL; // Use the same API URL as in MainComponent

const SettingsComponent = ({ onClose }) => {
    const [dayTypes, setDayTypes] = useState([]);
    const [newDayType, setNewDayType] = useState({ name: '', color: '' });
    const [editingDayType, setEditingDayType] = useState(null);

    const refreshDayTypes = () => {
        fetch(`${API_URL}/daytypes/`)
            .then(response => response.json())
            .then(data => setDayTypes(data.day_types))
            .catch(error => console.error('Error fetching day types:', error));
    };

    useEffect(() => {
        refreshDayTypes();
    }, []);

    const saveDayType = () => {
        const url = editingDayType ? `${API_URL}/daytypes/${editingDayType._id}` : `${API_URL}/daytypes/`;
        const method = editingDayType ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newDayType)
        })
        .then(response => response.json())
        .then(data => {
            setNewDayType({ name: '', color: '' });
            setEditingDayType(null);
            refreshDayTypes(); // Refresh the list
        })
        .catch(error => console.error('Error saving day type:', error));
    };

    const deleteDayType = (dayTypeId) => {
        fetch(`${API_URL}/daytypes/${dayTypeId}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                refreshDayTypes(); // Refresh the list after deletion
            })
            .catch(error => console.error('Error deleting day type:', error));
    };

    const editDayType = (dayType) => {
        setEditingDayType(dayType);
        setNewDayType({ name: dayType.name, color: dayType.color });
    };

    return (
        <div className="settingsContainer">
            <h2>Day Types Settings</h2>
            <div>
                {dayTypes.map(dayType => (
                    <div key={dayType._id} className="dayTypeItem">
                        {dayType.name} ({dayType.color})
                        <FontAwesomeIcon icon={faEdit} onClick={() => editDayType(dayType)} />
                        <FontAwesomeIcon icon={faTrashAlt} onClick={() => deleteDayType(dayType._id)} />
                    </div>
                ))}
            </div>
            <div className="dayTypeForm">
                <input 
                    type="text" 
                    value={newDayType.name} 
                    onChange={(e) => setNewDayType({ ...newDayType, name: e.target.value })}
                    placeholder="Day Type Name"
                    required
                />
                <input 
                    type="text" 
                    value={newDayType.color} 
                    onChange={(e) => setNewDayType({ ...newDayType, color: e.target.value })}
                    placeholder="Day Type Color"
                />
                <button onClick={saveDayType}>{editingDayType ? 'Update' : 'Add'}</button>
            </div>
            <button onClick={onClose}>Close</button>
        </div>
    );
};

export default SettingsComponent;
