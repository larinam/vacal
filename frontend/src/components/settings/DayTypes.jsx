import React, {useEffect, useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faEdit, faTrashAlt} from '@fortawesome/free-solid-svg-icons';
import './DayTypes.css';
import {useApi} from '../../hooks/useApi';
import {toast} from "react-toastify";
import DayTypeModal from './DayTypeModal';

const DayTypes = () => {
    const [dayTypes, setDayTypes] = useState([]);
    const [showDayTypeModal, setShowDayTypeModal] = useState(false);
    const [editingDayType, setEditingDayType] = useState(null);
    const { apiCall } = useApi();

    const refreshDayTypes = async () => {
        const data = await apiCall('/daytypes');
        setDayTypes(data.day_types);
    };

    useEffect(() => {
        refreshDayTypes();
    }, []);

    const handleAddDayTypeClick = () => {
        setEditingDayType(null); // Reset the editing day type
        setShowDayTypeModal(true); // Show the modal for adding a new day type
    };

    const handleEditDayTypeClick = (dayType) => {
        setEditingDayType(dayType); // Set the day type data for editing
        setShowDayTypeModal(true); // Show the modal for editing
    };

    const handleDeleteDayType = async (dayTypeId) => {
        const isConfirmed = window.confirm('Are you sure you want to delete this day type?');
        if (isConfirmed) {
            try {
                await apiCall(`/daytypes/${dayTypeId}`, 'DELETE');
                refreshDayTypes(); // Refresh the list after deletion
                toast.success('Day type deleted successfully');
            } catch (error) {
                console.error('Error deleting day type:', error);
                toast.error('Error deleting day type');
            }
        }
    };

    const handleModalClose = () => {
        setShowDayTypeModal(false);
        refreshDayTypes(); // Refresh the day types list after closing the modal
    };

    return (
        <div className="settingsDayTypesContainer">
            <h2>Day Types Settings</h2>
            <button onClick={handleAddDayTypeClick}>Add Day Type</button>
            <table className="settingsTable">
                <thead>
                <tr>
                    <th>Name</th>
                    <th>Identifier</th>
                    <th>Color</th>
                    <th>Absence</th>
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
                          <td>{dayType.is_absence ? 'Yes' : 'No'}</td>
                          <td>
                              <FontAwesomeIcon icon={faEdit} onClick={() => handleEditDayTypeClick(dayType)}
                                               className="firstActionIcon"
                              />
                              <FontAwesomeIcon icon={faTrashAlt}
                                               onClick={() => handleDeleteDayType(dayType._id)}
                                               className="actionIcon"
                              />
                          </td>
                      </tr>
                    ))}
                </tbody>
            </table>
            {showDayTypeModal && (
                <DayTypeModal
                    isOpen={showDayTypeModal}
                    onClose={handleModalClose}
                    editingDayType={editingDayType}
                />
            )}
        </div>
    );
};

export default DayTypes;
