import React, {useEffect, useState} from 'react';
import {useLocalStorage} from '../hooks/useLocalStorage';
import Modal from './Modal';

const ReportFormModal = ({ isOpen, onClose, onGenerateReport, teams = [] }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTeams, setSelectedTeams] = useLocalStorage('reportSelectedTeams', []);


    useEffect(() => {
        if (isOpen) {
            if (selectedTeams.length > 0) {
                const validTeams = teams.filter(t => selectedTeams.includes(t._id)).map(t => t._id);
                setSelectedTeams(validTeams);
            } else {
                setSelectedTeams(teams.map(t => t._id));
            }
        }
    }, [isOpen, teams]);

    const handleTeamChange = (e) => {
        const id = e.target.value;
        if (e.target.checked) {
            setSelectedTeams(prev => [...prev, id]);
        } else {
            setSelectedTeams(prev => prev.filter(tid => tid !== id));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onGenerateReport(startDate, endDate, selectedTeams);
        setStartDate(''); // Reset the start date state
        setEndDate('');   // Reset the end date state
        onClose();        // Close the modal
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
                <form onSubmit={handleSubmit}>
                    <label>
                        Start date
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                        />
                    </label>
                    <label>
                        End date
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                        />
                    </label>
                    <fieldset>
                        <legend>Select Teams</legend>
                        {teams.map(team => (
                            <label key={team._id} style={{display: 'block'}}>
                                <input
                                    type="checkbox"
                                    value={team._id}
                                    checked={selectedTeams.includes(team._id)}
                                    onChange={handleTeamChange}
                                />
                                {team.name}
                            </label>
                        ))}
                    </fieldset>
                    <div className="button-container">
                        <button type="submit">Generate Report</button>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                </form>
        </Modal>
    );
};

export default ReportFormModal;
