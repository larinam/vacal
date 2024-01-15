import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt, faEdit } from '@fortawesome/free-solid-svg-icons';
import './SettingsComponent.css';

const API_URL = process.env.REACT_APP_API_URL;

const SettingsComponent = ({ onClose, authHeader }) => {
    const [dayTypes, setDayTypes] = useState([]);
    const [newDayType, setNewDayType] = useState({ name: '', color: '' });
    const [editingDayType, setEditingDayType] = useState(null);

    const getHeaders = () => {
        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }
        return headers;
    };
    
    const refreshDayTypes = () => {
        fetch(`${API_URL}/daytypes/`, { headers: getHeaders() })
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
            headers: getHeaders(),
            body: JSON.stringify(newDayType)
        })
        .then(response => response.json())
        .then(data => {
            setNewDayType({ name: '', color: '' });
            setEditingDayType(null);
            refreshDayTypes();
        })
        .catch(error => console.error('Error saving day type:', error));
    };

    const deleteDayType = (dayTypeId) => {
        fetch(`${API_URL}/daytypes/${dayTypeId}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        })
            .then(response => response.json())
            .then(data => {
                refreshDayTypes();
            })
            .catch(error => console.error('Error deleting day type:', error));
    };

    const editDayType = (dayType) => {
        setEditingDayType(dayType);
        setNewDayType({ name: dayType.name, color: dayType.color });
    };

    const onColorChange = (e) => {
        setNewDayType({ ...newDayType, color: e.target.value });
    };

    return (
        <div className="settingsContainer">
            <h2>Day Types Settings</h2>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Color</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {dayTypes.map(dayType => (
                        <tr key={dayType._id}>
                            <td>{dayType.name}</td>
                            <td>
                                <div className="colorCircle" style={{ backgroundColor: dayType.color }}></div>
                                {dayType.color}
                            </td>
                            <td>
                                <FontAwesomeIcon icon={faEdit} onClick={() => editDayType(dayType)} />
                                <FontAwesomeIcon icon={faTrashAlt} onClick={() => deleteDayType(dayType._id)} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

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
                <input
                    type="color"
                    value={newDayType.color}
                    onChange={onColorChange}
                />
                <button onClick={saveDayType}>{editingDayType ? 'Update' : 'Add'}</button>
            </div>
            <button onClick={onClose}>Close</button>
        </div>
    );
};

export default SettingsComponent;
