import React, {useEffect, useState} from 'react';
import {toast} from "react-toastify";
import {useApi} from '../../hooks/useApi';
import './DayTypeModal.css'; // Import the CSS file
import Modal from '../Modal';

const DayTypeModal = ({ isOpen, onClose, editingDayType }) => {
    const [dayTypeData, setDayTypeData] = useState({
        name: '',
        identifier: '',
        color: '',
        is_absence: false,
    });
    const { apiCall } = useApi();

    useEffect(() => {
        if (editingDayType) {
            setDayTypeData({
                name: editingDayType.name,
                identifier: editingDayType.identifier,
                color: editingDayType.color,
                is_absence: editingDayType.is_absence,
            });
        }
    }, [editingDayType]);


    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const method = editingDayType ? 'PUT' : 'POST';
        const url = editingDayType ? `/daytypes/${editingDayType._id}` : `/daytypes`;

        try {
            await apiCall(url, method, dayTypeData);
            onClose(); // Close the modal and refresh the day types list
        } catch (error) {
            console.error('Error saving day type:', error);
            toast.error('Error saving day type');
        }
    };

    const handleChange = (e) => {
        const { name, type, checked, value } = e.target;
        setDayTypeData({ ...dayTypeData, [name]: type === 'checkbox' ? checked : value });
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
                <form onSubmit={handleFormSubmit}>
                    <input
                        autoFocus={true}
                        type="text"
                        name="name"
                        value={dayTypeData.name}
                        onChange={handleChange}
                        placeholder="Day Type Name"
                        required
                    />
                    <input
                        type="text"
                        name="identifier"
                        value={dayTypeData.identifier}
                        onChange={handleChange}
                        placeholder="Day Type Identifier"
                        required
                    />
                    <div className="color-input-container">
                        <input
                            type="text"
                            name="color"
                            value={dayTypeData.color}
                            onChange={handleChange}
                            placeholder="Day Type Color"
                        />
                        <input
                            type="color"
                            name="color"
                            value={dayTypeData.color}
                            onChange={handleChange}
                            className="color-picker"
                        />
                    </div>
                    <label className="form-checkbox">
                        <input
                            type="checkbox"
                            name="is_absence"
                            checked={dayTypeData.is_absence}
                            onChange={handleChange}
                        />
                        <span>Absence</span>
                    </label>
                    <div className="button-container">
                        <button type="submit">{editingDayType ? 'Update' : 'Add'} Day Type</button>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                </form>
        </Modal>
    );
};

export default DayTypeModal;
