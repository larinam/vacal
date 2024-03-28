import React, {useEffect, useRef, useState} from 'react';
import {Navigate, Route, Routes, useNavigate} from 'react-router-dom';
import CalendarComponent from './CalendarComponent';
import SettingsComponent from './settings/SettingsComponent';
import ReportFormModal from './ReportFormModal'; // Import the ReportFormModal component
import './MainComponent.css';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faCog, faFileExcel, faSignOut} from '@fortawesome/free-solid-svg-icons';
import {useApi} from '../hooks/useApi';
import {useAuth} from '../contexts/AuthContext';

const MainComponent = () => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false); // State to control the visibility of the ReportFormModal
    const {apiCall, isLoading} = useApi();
    const { handleLogout } = useAuth();

    const abortControllerRef = useRef(null);

    const fetchData = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        try {
            const data = await apiCall('/', 'GET', null, false, signal);
            if (!signal.aborted) {
                setData(data);
            }
        } catch (error) {
            if (!signal.aborted) {
                console.error('Error fetching data:', error);
            }
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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
                    <FontAwesomeIcon icon={faFileExcel}/>
                </div>
                <div className="settingsIcon" onClick={() => navigate('/main/settings')} title="Settings">
                    <FontAwesomeIcon icon={faCog}/>
                </div>
                <div className="settingsIcon" onClick={() => {handleLogout(); navigate('/')}} title="Logout">
                    <FontAwesomeIcon icon={faSignOut}/>
                </div>
            </div>
            <div className="content">
                <Routes>
                    <Route index element={
                        <CalendarComponent
                            serverTeamData={data.teams}
                            holidays={data.holidays}
                            dayTypes={data.day_types}
                            currentMonth={new Date()}
                            updateTeamData={fetchData}
                        />
                    } />
                    <Route path="settings/*" element={<SettingsComponent onClose={() => {navigate("/main"); fetchData()}} />} />
                    {/* You can add more nested routes here */}
                    <Route path="*" element={<Navigate to="/main" replace />} />
                </Routes>
            </div>
            <footer className="footer">
                This application, Vacal, is an open source project. For more details, visit our&nbsp;
                <a href="https://github.com/larinam/vacal" target="_blank" rel="noopener noreferrer">GitHub
                    repository</a>.
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