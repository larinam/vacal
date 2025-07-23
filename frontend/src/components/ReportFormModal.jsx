import React, {useEffect, useRef, useState} from 'react';

const ReportFormModal = ({ isOpen, onClose, onGenerateReport, teams = [] }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTeams, setSelectedTeams] = useState([]);
    const modalContentRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalContentRef.current && !modalContentRef.current.contains(event.target)) {
                onClose();
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            const savedTeams = JSON.parse(localStorage.getItem('reportSelectedTeams') || '[]');
            if (savedTeams.length > 0) {
                const validTeams = teams.filter(t => savedTeams.includes(t._id)).map(t => t._id);
                setSelectedTeams(validTeams);
            } else {
                setSelectedTeams(teams.map(t => t._id));
            }
        }
    }, [isOpen, teams]);

    useEffect(() => {
        if (isOpen) {
            localStorage.setItem('reportSelectedTeams', JSON.stringify(selectedTeams));
        }
    }, [selectedTeams, isOpen]);

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
        <div className="modal">
            <div className="modal-content" ref={modalContentRef}>
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
            </div>
        </div>
    );
};

export default ReportFormModal;
