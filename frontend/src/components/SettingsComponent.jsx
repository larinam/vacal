import React from 'react';
import SettingsDayTypes from './SettingsDayTypes';
import SettingsUserManagement from './SettingsUserManagement';
import { NavLink, Routes, Route } from 'react-router-dom';
import './SettingsComponent.css';

const SettingsComponent = ({ onClose }) => {
    return (
        <div className="settingsContainer">
            <div className="settingsNavigation">
                <button onClick={onClose} className="closeButton">Close</button>
                <NavLink to="daytypes" className="navItem" activeClassName="active">
                    Day Types
                </NavLink>
                <NavLink to="usermanagement" className="navItem" activeClassName="active">
                    User Management
                </NavLink>
            </div>
            <div className="settingsContent">
                <Routes>
                    <Route path="daytypes" element={<SettingsDayTypes />} />
                    <Route path="usermanagement" element={<SettingsUserManagement />} />
                    {/* Redirect to default tab */}
                    <Route path="/" element={<SettingsDayTypes />} />
                </Routes>
            </div>
        </div>
    );
};

export default SettingsComponent;
