import React from 'react';
import {Navigate, NavLink, Route, Routes} from 'react-router-dom';
import DayTypes from './DayTypes';
import UserManagement from './UserManagement';
import SubscriptionManagement from "./SubscriptionManagement";
import './SettingsComponent.css';
import {useConfig} from "../../contexts/ConfigContext";

export const SETTINGS_BASE_PATH = '/main/settings';
export const SETTINGS_DEFAULT_TAB = 'daytypes';
export const SETTINGS_DEFAULT_PATH = `${SETTINGS_BASE_PATH}/${SETTINGS_DEFAULT_TAB}`;

const SettingsComponent = ({onClose}) => {
  const {isMultitenancyEnabled} = useConfig();
  const navItemClass = ({isActive}) => `navItem${isActive ? ' active' : ''}`;
  const defaultTabPath = SETTINGS_DEFAULT_TAB;

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
          to="usermanagement"
          end
          className={navItemClass}
        >
          Users
        </NavLink>
        {isMultitenancyEnabled && (
          <NavLink
            to="subscription"
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
