import React from 'react';
import {NavLink, Route, Routes, useLocation} from 'react-router-dom';
import DayTypes from './DayTypes';
import UserManagement from './UserManagement';
import SubscriptionManagement from "./SubscriptionManagement";
import './SettingsComponent.css';
import {useConfig} from "../../contexts/ConfigContext";

const SettingsComponent = ({onClose}) => {
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/$/, ''); // Remove trailing slash if it exists
  const isDefaultActive = normalizedPath === '/main/settings';
  const {isMultitenancyEnabled} = useConfig();

  return (
    <div className="settingsContainer">
      <div className="settingsNavigation">
        <button onClick={onClose} className="closeButton">Close</button>
        <NavLink
          to="daytypes"
          className={`navItem ${isDefaultActive ? 'active' : ''}`}
          activeclassname="active"
        >
          Day Types
        </NavLink>
        <NavLink
          to="usermanagement"
          className="navItem"
          activeclassname="active"
        >
          Users
        </NavLink>
        {isMultitenancyEnabled && (
          <NavLink
            to="subscription"
            className="navItem"
            activeclassname="active"
          >
            Subscription
          </NavLink>
        )}
      </div>
      <div className="settingsContent">
        <Routes>
          <Route path="daytypes" element={<DayTypes/>}/>
          <Route path="usermanagement" element={<UserManagement/>}/>
          {isMultitenancyEnabled && (
            <Route path="subscription" element={<SubscriptionManagement/>}/>
          )}
          {/* Redirect to default tab */}
          <Route path="/" element={<DayTypes/>}/>
        </Routes>
      </div>
    </div>
  );
};

export default SettingsComponent;
