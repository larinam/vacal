import React, { useState, useEffect } from 'react';
import CalendarComponent from './CalendarComponent';
import SettingsComponent from './SettingsComponent';
import './MainComponent.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { useApi } from '../hooks/useApi';

const MainComponent = () => {
    const [data, setData] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const { apiCall, isLoading } = useApi();

    const fetchData = async () => {
        try {
            const data = await apiCall('/');
            setData(data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleSettings = () => setShowSettings(!showSettings);

    if (!data) return <div>Loading...</div>;

    return (
        <div className="mainContainer">
            <div className="settingsIcon" onClick={toggleSettings}>
                {isLoading && <span>Loading...</span>}
                <FontAwesomeIcon icon={faCog} />
            </div>
            <div className="content">
                {showSettings ? (
                    <SettingsComponent onClose={toggleSettings} />
                    ) : (
                    <CalendarComponent
                        teamData={data.teams}
                        holidays={data.holidays}
                        dayTypes={data.day_types}
                        currentMonth={new Date()}
                        updateTeamData={fetchData}
                    />
                )}
            </div>
            <footer className="footer">
                This application, Vacal, is an open source project. For more details, visit our&nbsp;
                <a href="https://github.com/larinam/vacal" target="_blank" rel="noopener noreferrer">GitHub repository</a>.
            </footer>
        </div>
    );
};

export default MainComponent;
