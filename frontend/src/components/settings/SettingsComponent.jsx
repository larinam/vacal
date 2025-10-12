import React from 'react';
import {Navigate, NavLink, Route, Routes} from 'react-router-dom';
import DayTypes from './DayTypes';
import UserManagement from './UserManagement';
import SubscriptionManagement from "./SubscriptionManagement";
import './SettingsComponent.css';
import {useConfig} from "../../contexts/ConfigContext";

const SETTINGS_BASE_PATH = '/main/settings';

const SettingsComponent = ({onClose}) => {
  const {isMultitenancyEnabled} = useConfig();
  const navItemClass = ({isActive}) => `navItem${isActive ? ' active' : ''}`;
  const defaultTabPath = `${SETTINGS_BASE_PATH}/daytypes`;

  return (
    <div className="settingsContainer">
      <div className="settingsNavigation">
        <button onClick={onClose} className="closeButton">Close</button>
        <NavLink
          to={defaultTabPath}
          end
          className={navItemClass}
        >
          Day Types
        </NavLink>
        <NavLink
          to={`${SETTINGS_BASE_PATH}/usermanagement`}
          end
          className={navItemClass}
        >
          Users
        </NavLink>
        {isMultitenancyEnabled && (
          <NavLink
            to={`${SETTINGS_BASE_PATH}/subscription`}
            end
            className={navItemClass}
          >
            Subscription
          </NavLink>
        )}
      </div>
      <div className="settingsContent">
        <Routes>
          <Route index element={<Navigate to={defaultTabPath} replace />} />
          <Route path="daytypes" element={<DayTypes/>}/>
          <Route path="usermanagement" element={<UserManagement/>}/>
          {isMultitenancyEnabled && (
            <Route path="subscription" element={<SubscriptionManagement/>}/>
          )}
          <Route path="*" element={<Navigate to={defaultTabPath} replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default SettingsComponent;
