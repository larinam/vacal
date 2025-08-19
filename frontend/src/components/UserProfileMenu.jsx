import React, {useEffect, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faCog, faPlus, faQuestion, faSignOut, faUserPlus, faBriefcase, faUser} from '@fortawesome/free-solid-svg-icons';
import './UserProfileMenu.css';
import {useAuth} from "../contexts/AuthContext";

const UserProfileMenu = ({setShowDropdown}) => {
  const navigate = useNavigate();
  const {handleLogout, user, currentTenant, setCurrentTenant} = useAuth();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setShowDropdown]);

  const handleTenantSwitch = (tenant) => {
    if (tenant.identifier !== currentTenant) {
      setCurrentTenant(tenant.identifier);
      navigate(0); // This triggers a full page reload, or navigate to a specific path if required
    }
    setShowDropdown(false); // Close the dropdown after switching
  };

  return (
    <div className="dropdownMenu" ref={dropdownRef}>
      <div className="dropdownItem" style={{cursor: 'default', backgroundColor: 'transparent', transition: 'none'}}>
        <span>{user.name}{user.tenants.length > 1 ? ` (${currentTenant})` : ''}</span>
      </div>
      <div className="dropdownItem" onClick={() => {
        navigate('/main/settings/usermanagement?profile=true');
        setShowDropdown(false);
      }}>
        <FontAwesomeIcon icon={faUser}/>
        <span>My profile</span>
      </div>
      <div className="dropdownItem" onClick={() => {
        navigate('/main/settings');
        setShowDropdown(false); // This will close the dropdown menu when the item is clicked
      }}>
        <FontAwesomeIcon icon={faCog}/>
        <span>Settings</span>
      </div>
      <div className="dropdownItem" onClick={() => {
        navigate('/main/settings/usermanagement?inviteUser=true');
        setShowDropdown(false); // This will close the dropdown menu when the item is clicked
      }}>
        <FontAwesomeIcon icon={faUserPlus}/>
        <span>Invite user</span>
      </div>
      <hr/>
      {user.tenants.length > 1 &&
        user.tenants.map((tenant) => (
          <div
            key={tenant.identifier}
            className="dropdownItem"
            onClick={() => handleTenantSwitch(tenant)}
            style={{fontWeight: tenant.identifier === currentTenant ? 'bold' : 'normal'}}
          >
            <FontAwesomeIcon icon={faBriefcase} />
            <span>{tenant.name} ({tenant.identifier})</span>
          </div>
        ))
      }
      <div className="dropdownItem" style={{'user-select': 'none'}} onClick={() => {
        navigate('/create-additional-workspace');
      }}>
        <FontAwesomeIcon icon={faPlus}/>
        <span>Create workspace</span>
      </div>

      <hr/>
      <div className="dropdownItem" onClick={() => {
        window.open('https://t.me/larinam', '_blank');
        setShowDropdown(false); // This will close the dropdown menu when the item is clicked
      }}>
        <FontAwesomeIcon icon={faQuestion}/>
        <span>Support</span>
      </div>
      <div className="dropdownItem" style={{'user-select': 'none'}} onClick={() => {
        handleLogout();
        navigate('/');
      }}>
        <FontAwesomeIcon icon={faSignOut}/>
        <span>Log out</span>
      </div>
    </div>
  );
};

export default UserProfileMenu;
