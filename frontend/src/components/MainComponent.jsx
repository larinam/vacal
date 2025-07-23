import React, {useEffect, useRef, useState} from 'react';
import {Navigate, Route, Routes, useNavigate} from 'react-router-dom';
import CalendarComponent from './CalendarComponent';
import SettingsComponent from './settings/SettingsComponent';
import ReportFormModal from './ReportFormModal';
import './MainComponent.css';
import './Modal.css';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faFileExcel, faUserCircle} from '@fortawesome/free-solid-svg-icons';
import {useApi} from '../hooks/useApi';
import {useAuth} from '../contexts/AuthContext';
import UserProfileMenu from "./UserProfileMenu";

const MainComponent = () => {
    const navigate = useNavigate();
    const {apiCall, isLoading} = useApi();
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [lastCheckedDate, setLastCheckedDate] = useState(new Date().toDateString());
    const [showReportModal, setShowReportModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const abortControllerRef = useRef(null);

    const toggleDropdown = () => setShowDropdown(!showDropdown);

    const getUserInitials = () => {
        const splitName = user?.name?.toUpperCase().split(' ');
        if (splitName?.length > 1) {
            return `${splitName[0][0]}${splitName[1][0]}`;
        }
        return splitName?.[0]?.[0] ?? <FontAwesomeIcon icon={faUserCircle} />;
    };

    const fetchData = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        try {
            const data = await apiCall('/teams', 'GET', null, false, signal);
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
        const intervalId = setInterval(() => {
            const currentDate = new Date().toDateString();
            if (currentDate !== lastCheckedDate) {
                fetchData();
                setLastCheckedDate(currentDate);
            }
        }, 60000); // Check every minute

        return () => {
            clearInterval(intervalId);
        };
    }, [lastCheckedDate]);

    const openReportModal = () => {
        setShowReportModal(true);
    };

    const handleGenerateReport = async (startDate, endDate, teamIds) => {
        setShowReportModal(false);
        const teamsQuery = teamIds && teamIds.length > 0 ? `&${teamIds.map(id => `team_ids=${id}`).join('&')}` : '';
        const reportUrl = `/teams/export-vacations?start_date=${startDate}&end_date=${endDate}${teamsQuery}`;

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

    if (!data) return (
        <div className="initial-loading">
            <div className="spinner large" role="status" aria-label="Loading" />
        </div>
    );

    return (
        <div className="mainContainer">
            <div className="loadingIndicator">
                {isLoading && <div className="spinner" role="status" aria-label="Loading" />}
            </div>
            <div className="iconContainer">
                <div className="reportIcon" onClick={openReportModal} title="Generate Report">
                    <FontAwesomeIcon icon={faFileExcel}/>
                </div>
                <div className="userIcon" onClick={toggleDropdown}>
                    {getUserInitials() || <FontAwesomeIcon icon={faUserCircle} />}
                </div>
                {showDropdown && <UserProfileMenu setShowDropdown={setShowDropdown} />}
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
                teams={data.teams}
            />
        </div>
    );
};

export default MainComponent;
