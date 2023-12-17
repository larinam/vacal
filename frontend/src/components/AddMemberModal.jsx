import React, { useState, useEffect, useRef } from 'react';

const API_URL = process.env.REACT_APP_API_URL;

const AddMemberModal = ({ isOpen, onClose, selectedTeamId, updateTeamData, authHeader, editingMember }) => {
    const [newMemberData, setNewMemberData] = useState({ name: '', country: '', vac_days: [] });
    const modalContentRef = useRef(null);

    useEffect(() => {
        if (editingMember) {
            setNewMemberData(editingMember);
        } else {
            setNewMemberData({ name: '', country: '', vac_days: [] });
        }
    }, [editingMember]);

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

    const getHeaders = () => {
        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }
        return headers;
    };

    const handleAddMemberFormSubmit = async (e) => {
        e.preventDefault();
        const method = editingMember ? 'PUT' : 'POST';
        const url = API_URL + (editingMember ? `/teams/${selectedTeamId}/members/${editingMember.uid}` : `/teams/${selectedTeamId}/members/`);
        try {
            const response = await fetch(url, {
                method: method,
                headers: getHeaders(),
                body: JSON.stringify(newMemberData),
            });

            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            setNewMemberData({ name: '', country: '', vac_days: [] }); // Reset form data after successful submission
            onClose(); // Close modal
            updateTeamData(); // Refresh data
        } catch (error) {
            console.error('Error adding team member:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal">
            <div className="modal-content" ref={modalContentRef}>
                <form onSubmit={handleAddMemberFormSubmit}>
                    <input
                        type="text"
                        value={newMemberData.name}
                        onChange={(e) => setNewMemberData({ ...newMemberData, name: e.target.value })}
                        placeholder="Enter member's name"
                        required
                    />
                    <input
                        type="text"
                        value={newMemberData.country}
                        onChange={(e) => setNewMemberData({ ...newMemberData, country: e.target.value })}
                        placeholder="Enter member's country"
                        required
                    />
                    {/* Add input fields for vacation days if needed */}
                    <div className="button-container">
                        <button type="submit">{editingMember ? 'Edit Member' : 'Add Member'}</button>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddMemberModal;
