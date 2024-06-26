import React, {useEffect, useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faEdit, faTrashAlt} from '@fortawesome/free-solid-svg-icons';
import './DayTypes.css';
import {useApi} from '../../hooks/useApi';
import {toast} from "react-toastify";

const DayTypes = () => {
    const [dayTypes, setDayTypes] = useState([]);
    const [newDayType, setNewDayType] = useState({ name: '', identifier: '', color: '' });
    const [editingDayType, setEditingDayType] = useState(null);
    const { apiCall } = useApi();

    const refreshDayTypes = async () => {
        const data = await apiCall('/daytypes');
        setDayTypes(data.day_types);
    };

    useEffect(() => {
        refreshDayTypes();
    }, []);

    const saveDayType = async () => {
        const url = editingDayType ? `/daytypes/${editingDayType._id}` : `/daytypes`;
        const method = editingDayType ? 'PUT' : 'POST';
        try {
            await apiCall(url, method, newDayType);
            setNewDayType({ name: '', identifier: '', color: '' });
            setEditingDayType(null);
            refreshDayTypes();
        } catch (error) {
            console.error('Error saving day type:', error);
            toast.error(error?.data?.detail);
        }
    };

    const deleteDayType = async (dayTypeId) => {
        try {
            await apiCall(`/daytypes/${dayTypeId}`, 'DELETE', newDayType);
            refreshDayTypes();
        } catch (error) {
            console.error('Error deleting day type:', error);
            toast.error(error?.data?.detail);
        }
    };

    const editDayType = (dayType) => {
        setEditingDayType(dayType);
        setNewDayType({ name: dayType.name, identifier: dayType.identifier, color: dayType.color });
    };

    const onColorChange = (e) => {
        setNewDayType({ ...newDayType, color: e.target.value });
    };

    return (
        <div className="settingsDayTypesContainer">
            <h2>Day Types Settings</h2>
            <table>
                <thead>
                <tr>
                    <th>Name</th>
                    <th>Identifier</th>
                    <th>Color</th>
                    <th>Actions</th>
                </tr>
                </thead>
                <tbody>
                    {dayTypes.map(dayType => (
                      <tr key={dayType._id}>
                          <td>{dayType.name}</td>
                          <td>{dayType.identifier}</td>
                          <td>
                              <div className="colorCircle" style={{backgroundColor: dayType.color}}></div>
                              {dayType.color}
                          </td>
                          <td>
                              <FontAwesomeIcon icon={faEdit} onClick={() => editDayType(dayType)}/>
                              <FontAwesomeIcon icon={faTrashAlt} onClick={() => deleteDayType(dayType._id)}/>
                          </td>
                      </tr>
                    ))}
                </tbody>
            </table>

            <div className="dayTypeForm">
                <input
                  type="text"
                  value={newDayType.name}
                  onChange={(e) => setNewDayType({...newDayType, name: e.target.value})}
                  placeholder="Day Type Name"
                  required
                />
                <input
                  type="text"
                  value={newDayType.identifier}
                  onChange={(e) => setNewDayType({...newDayType, identifier: e.target.value})}
                  placeholder="Day Type Identifier"
                  required
                />
                <input
                  type="text"
                  value={newDayType.color}
                  onChange={(e) => setNewDayType({...newDayType, color: e.target.value})}
                  placeholder="Day Type Color"
                />
                <input
                  type="color"
                  value={newDayType.color}
                  onChange={onColorChange}
                />
                <button onClick={saveDayType}>{editingDayType ? 'Update' : 'Add'}</button>
            </div>
        </div>
    );
};

export default DayTypes;
