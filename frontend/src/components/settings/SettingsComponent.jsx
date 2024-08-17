import React from 'react';
import DayTypes from './DayTypes';
import UserManagement from './UserManagement';
import {NavLink, Route, Routes} from 'react-router-dom';
import './SettingsComponent.css';

const SettingsComponent = ({ onClose }) => {
    return (
        <div className="settingsContainer">
            <div className="settingsNavigation">
                <button onClick={onClose} className="closeButton">Close</button>
                <NavLink to="daytypes" className="navItem" activeclassname="active">
                    Day Types
                </NavLink>
                <NavLink to="usermanagement" className="navItem" activeclassname="active">
                    Users
                </NavLink>
            </div>
            <div className="settingsContent">
                <Routes>
                    <Route path="daytypes" element={<DayTypes />} />
                    <Route path="usermanagement" element={<UserManagement />} />
                    {/* Redirect to default tab */}
                    <Route path="/" element={<DayTypes />} />
                </Routes>
            </div>
        </div>
    );
};

export default SettingsComponent;
