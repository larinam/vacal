import React, { useState, useEffect, useRef } from 'react';

const API_URL = process.env.REACT_APP_API_URL;
const AddTeamModal = ({ isOpen, onClose, updateTeamData, authHeader }) => {
    const [newTeamName, setNewTeamName] = useState('');
    const modalContentRef = useRef(null);

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

    const handleAddTeam = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(API_URL + '/teams/', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ name: newTeamName }),
            });

            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            setNewTeamName(''); // Reset input field
            onClose(); // Close modal
            updateTeamData(); // Refresh data
        } catch (error) {
            console.error('Error adding team:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal">
            <div className="modal-content" ref={modalContentRef}>
                <form onSubmit={handleAddTeam}>
                    <input
                        type="text"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="Enter team name"
                        required
                    />
                    <div className="button-container">
                        <button type="submit">Add Team</button>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddTeamModal;
