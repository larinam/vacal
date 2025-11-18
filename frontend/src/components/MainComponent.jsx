import React, {useEffect, useState} from 'react';
import {Navigate, Route, Routes, useNavigate} from 'react-router-dom';
import CalendarComponent from './CalendarComponent';
import SettingsComponent from './settings/SettingsComponent';
import ReportFormModal from './ReportFormModal';
import './MainComponent.css';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faFileExcel, faUserCircle} from '@fortawesome/free-solid-svg-icons';
import {useApi} from '../hooks/useApi';
import {useAuth} from '../contexts/AuthContext';
import UserProfileMenu from "./UserProfileMenu";
import {AnimatePresence} from 'motion/react';
import {useTeamsQuery} from '../hooks/queries/useTeamsQuery';
import {useIsFetching, useIsMutating} from '@tanstack/react-query';
import {useExportAbsencesMutation} from '../hooks/mutations/useExportAbsencesMutation';
import FontAwesomeIconWithTitle from './FontAwesomeIconWithTitle';

const MainComponent = () => {
    const navigate = useNavigate();
    const {apiCall} = useApi();
    const { user } = useAuth();
    const [lastCheckedDate, setLastCheckedDate] = useState(new Date().toDateString());
    const [showReportModal, setShowReportModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const {
        data: teamsResponse,
        refetch: refetchTeams,
        error: teamsError,
    } = useTeamsQuery(apiCall);
    const activeQueries = useIsFetching();
    const activeMutations = useIsMutating();
    const exportReportMutation = useExportAbsencesMutation(apiCall);
    const isBusy = activeQueries > 0 || activeMutations > 0;

    const toggleDropdown = () => setShowDropdown(!showDropdown);

    const getUserInitials = () => {
        const splitName = user?.name?.toUpperCase().split(' ');
        if (splitName?.length > 1) {
            return `${splitName[0][0]}${splitName[1][0]}`;
        }
        return splitName?.[0]?.[0] ?? <FontAwesomeIcon icon={faUserCircle} />;
    };

    useEffect(() => {
        if (teamsError) {
            console.error('Error fetching data:', teamsError);
        }
    }, [teamsError]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            const currentDate = new Date().toDateString();
            if (currentDate !== lastCheckedDate) {
                refetchTeams();
                setLastCheckedDate(currentDate);
            }
        }, 60000); // Check every minute

        return () => {
            clearInterval(intervalId);
        };
    }, [lastCheckedDate, refetchTeams]);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return undefined;
        }

        const { classList } = document.body;

        if (isBusy) {
            classList.add('is-api-loading');
        } else {
            classList.remove('is-api-loading');
        }

        return () => {
            classList.remove('is-api-loading');
        };
    }, [isBusy]);

    const openReportModal = () => {
        setShowReportModal(true);
    };

    const handleGenerateReport = (startDate, endDate, teamIds) => {
        setShowReportModal(false);
        exportReportMutation.mutate(
            {startDate, endDate, teamIds},
            {
                onSuccess: (blob) => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `absences_${startDate}_${endDate}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                },
                onError: (error) => {
                    console.error('Failed to download report:', error);
                },
            }
        );
    };

    if (!teamsResponse) return (
        <div className="initial-loading">
            <div className="spinner large" role="status" aria-label="Loading" />
        </div>
    );

    return (
        <div className="mainContainer">
            <div className="loadingIndicator">
                {isBusy && <div className="spinner" role="status" aria-label="Loading" />}
            </div>
            <div className="iconContainer">
                <FontAwesomeIconWithTitle
                    icon={faFileExcel}
                    title="Generate Report"
                    wrapperClassName="reportIcon"
                    wrapperProps={{
                        onClick: openReportModal,
                        role: 'button',
                    }}
                />
                <div className="userIcon" onClick={toggleDropdown}>
                    {getUserInitials() || <FontAwesomeIcon icon={faUserCircle} />}
                </div>
                <AnimatePresence>
                    {showDropdown && (
                        <UserProfileMenu setShowDropdown={setShowDropdown} />
                    )}
                </AnimatePresence>
            </div>
            <div className="content">
                <Routes>
                    <Route index element={
                        <CalendarComponent
                            serverTeamData={teamsResponse?.teams}
                            dayTypes={teamsResponse?.day_types}
                            currentMonth={new Date()}
                            updateTeamData={refetchTeams}
                        />
                    } />
                    <Route path="settings/*" element={<SettingsComponent onClose={() => {navigate("/main"); refetchTeams();}} />} />
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
                teams={teamsResponse?.teams}
            />
        </div>
    );
};

export default MainComponent;
