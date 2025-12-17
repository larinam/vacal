import React, {useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faCog, faPlus, faQuestion, faSignOut, faUserPlus, faBriefcase, faUser} from '@fortawesome/free-solid-svg-icons';
import './UserProfileMenu.css';
import {useAuth} from '../contexts/AuthContext';
import useDismiss from '../hooks/useDismiss';
import {motion} from 'motion/react';

const UserProfileMenu = ({setShowDropdown}) => {
  const navigate = useNavigate();
  const {handleLogout, user, currentTenant, setCurrentTenant} = useAuth();
  const dropdownRef = useRef(null);
  const closeDropdown = () => setShowDropdown(false);

  useDismiss(dropdownRef, closeDropdown, {includeEscape: true});

  const handleTenantSwitch = (tenant) => {
    if (tenant.identifier !== currentTenant) {
      setCurrentTenant(tenant.identifier);
      navigate(0); // This triggers a full page reload, or navigate to a specific path if required
    }
    closeDropdown();
  };

  return (
    <motion.div
      className="dropdownMenu"
      ref={dropdownRef}
      initial={{opacity: 0, scale: 0.95, y: -8}}
      animate={{opacity: 1, scale: 1, y: 0}}
      exit={{opacity: 0, scale: 0.95, y: -8, transition: {duration: 0.05, ease: 'easeIn'}}}
      transition={{duration: 0.2, ease: 'easeOut'}}
    >
      <div className="dropdownItem" style={{cursor: 'default', backgroundColor: 'transparent', transition: 'none'}}>
        <span>{user.name}{user.tenants.length > 1 ? ` (${currentTenant})` : ''}</span>
      </div>
      <div className="dropdownItem" onClick={() => {
        navigate('/main/settings/usermanagement?profile=true');
        closeDropdown();
      }}>
        <FontAwesomeIcon icon={faUser}/>
        <span>My profile</span>
      </div>
      <div className="dropdownItem" onClick={() => {
        navigate('/main/settings');
        closeDropdown();
      }}>
        <FontAwesomeIcon icon={faCog}/>
        <span>Settings</span>
      </div>
      <div className="dropdownItem" onClick={() => {
        navigate('/main/settings/usermanagement?inviteUser=true');
        closeDropdown();
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
        closeDropdown();
      }}>
        <FontAwesomeIcon icon={faPlus}/>
        <span>Create workspace</span>
      </div>

      <hr/>
      <div className="dropdownItem" onClick={() => {
        window.open('https://t.me/larinam', '_blank');
        closeDropdown();
      }}>
        <FontAwesomeIcon icon={faQuestion}/>
        <span>Support</span>
      </div>
      <div className="dropdownItem" style={{'user-select': 'none'}} onClick={() => {
        handleLogout();
        navigate('/');
        closeDropdown();
      }}>
        <FontAwesomeIcon icon={faSignOut}/>
        <span>Log out</span>
      </div>
    </motion.div>
  );
};

export default UserProfileMenu;
