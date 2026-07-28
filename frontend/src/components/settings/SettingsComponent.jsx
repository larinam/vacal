import React from 'react';
import {Navigate, NavLink, Route, Routes} from 'react-router-dom';
import DayTypes from './DayTypes';
import UserManagement from './UserManagement';
import SubscriptionManagement from "./SubscriptionManagement";
import './SettingsComponent.css';
import {useConfig} from "../../contexts/ConfigContext";

const SETTINGS_BASE_PATH = '/main/settings';
const USERS_PATH = `${SETTINGS_BASE_PATH}/usermanagement`;
const DAY_TYPES_PATH = `${SETTINGS_BASE_PATH}/daytypes`;
const SUBSCRIPTION_PATH = `${SETTINGS_BASE_PATH}/subscription`;

const SettingsComponent = ({onClose}) => {
  const {isMultitenancyEnabled} = useConfig();
  const navItemClass = ({isActive}) => `navItem${isActive ? ' active' : ''}`;
  const defaultTabPath = USERS_PATH;

  return (
    <div className="settingsContainer">
      <div className="settingsNavigation">
        <button onClick={onClose} className="closeButton">Close</button>
        <NavLink
          to={USERS_PATH}
          end
          className={navItemClass}
        >
          Users
        </NavLink>
        <NavLink
          to={DAY_TYPES_PATH}
          end
          className={navItemClass}
        >
          Day Types
        </NavLink>
        {isMultitenancyEnabled && (
          <NavLink
            to={SUBSCRIPTION_PATH}
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
          <Route path="usermanagement" element={<UserManagement/>}/>
          <Route path="daytypes" element={<DayTypes/>}/>
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
