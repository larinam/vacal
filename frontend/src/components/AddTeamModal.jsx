import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';

const AddTeamModal = ({ isOpen, onClose, updateTeamData, authHeader, editingTeam }) => {
    const [teamName, setTeamName] = useState('');
    const modalContentRef = useRef(null);
    const { apiCall } = useApi(authHeader);

    useEffect(() => {
        if (editingTeam) {
            setTeamName(editingTeam.name);
        } else {
            setTeamName('');
        }
    }, [editingTeam]);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        const method = editingTeam ? 'PUT' : 'POST';
        const url = editingTeam ? `/teams/${editingTeam._id}` : '/teams/';

        try {
            await apiCall(url, method, { name: teamName })
            setTeamName('');
            onClose();
            updateTeamData(); // Refresh data
        } catch (error) {
            console.error('Error in team operation:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal">
            <div className="modal-content" ref={modalContentRef}>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="Enter team name"
                        required
                    />
                    <div className="button-container">
                        <button type="submit">{editingTeam ? 'Edit Team' : 'Add Team'}</button>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddTeamModal;
