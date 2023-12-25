import React, { useState, useEffect } from 'react';
import CalendarComponent from './CalendarComponent';
import SettingsComponent from './SettingsComponent';
import './MainComponent.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';

const API_URL = process.env.REACT_APP_API_URL;

const MainComponent = ({ authHeader, onLogout }) => {
    const [data, setData] = useState(null);
    const [showSettings, setShowSettings] = useState(false);

    const fetchData = async () => {
        try {
            const response = await fetch(API_URL + '/', {
                headers: authHeader ? { 'Authorization': authHeader } : {}
            });
            if (response.status === 401) {
                onLogout();
                return;
            }
            const data = await response.json();
            setData(data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [authHeader, onLogout]);

    const toggleSettings = () => setShowSettings(!showSettings);

    if (!data) return <div>Loading...</div>;

    return (
        <div className="mainContainer">
            <div className="settingsIcon" onClick={toggleSettings}>
                <FontAwesomeIcon icon={faCog} />
            </div>
            {showSettings ? (
                <SettingsComponent onClose={toggleSettings} />
            ) : (
                <div className="content">
                    <CalendarComponent
                        teamData={data.teams}
                        holidays={data.holidays}
                        dayTypes={data.day_types}
                        currentMonth={new Date()}
                        updateTeamData={fetchData}
                        authHeader={authHeader}
                    />
                </div>
            )}
            <footer className="footer">
                This application, Vacal, is an open source project. For more details, visit our&nbsp;
                <a href="https://github.com/larinam/vacal" target="_blank" rel="noopener noreferrer">GitHub repository</a>.
            </footer>
        </div>
    );
};

export default MainComponent;
