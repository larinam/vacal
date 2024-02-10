import React, { useState, useEffect } from 'react';
import CalendarComponent from './CalendarComponent';
import SettingsComponent from './SettingsComponent';
import ReportFormModal from './ReportFormModal'; // Import the ReportFormModal component
import './MainComponent.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faFileExcel } from '@fortawesome/free-solid-svg-icons';
import { useApi } from '../hooks/useApi';

const MainComponent = () => {
    const [data, setData] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false); // State to control the visibility of the ReportFormModal
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

    const toggleSettings = async () => {
        if (showSettings) {
            await fetchData();
        }
        setShowSettings(!showSettings);
    };

    const openReportModal = () => {
        setShowReportModal(true);
    };

    const handleGenerateReport = async (startDate, endDate) => {
        setShowReportModal(false);
        const reportUrl = `/export-vacations/?start_date=${startDate}&end_date=${endDate}`;

        try {
            const blob = await apiCall(reportUrl, 'GET', null, true); // Set isBlob to true
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vacations_${startDate}_${endDate}.xlsx`; // Set the desired file name
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (error) {
            console.error('Failed to download report:', error);
        }
    };

    if (!data) return <div>Loading...</div>;

    return (
        <div className="mainContainer">
            <div className="loadingIndicator">
                {isLoading && 'Loading...'}
            </div>
            <div className="iconContainer">
                <div className="reportIcon" onClick={openReportModal} title="Generate Report">
                    <FontAwesomeIcon icon={faFileExcel} />
                </div>
                <div className="settingsIcon" onClick={toggleSettings} title="Settings">
                    <FontAwesomeIcon icon={faCog} />
                </div>
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
            <ReportFormModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                onGenerateReport={handleGenerateReport}
            />
        </div>
    );
};

export default MainComponent;
