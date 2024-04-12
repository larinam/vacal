import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useApi} from '../../hooks/useApi';
import {toast} from "react-toastify";
import './InitialUserCreation.css';

const InitialUserCreation = () => {
  const navigate = useNavigate();
  const {apiCall} = useApi();
  const [tenantName, setTenantName] = useState('');
  const [tenantIdentifier, setTenantIdentifier] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tenant = {name: tenantName, identifier: tenantIdentifier};
    try {
      await apiCall('/users/create-initial', 'POST', {tenant, name, email, username, password});
      navigate('/login');
    } catch (error) {
      console.error('Error creating initial user:', error);
      if (error.data && error.data.detail) {
        toast(error.data.detail);
      } else {
        toast("An error occurred. Please try again.");
      }
    }
  };

  return (
    <div className="initialUserCreationContainer">
      <button
        className="logInButton"
        onClick={() => navigate('/login')}
      >
        Log in
      </button>
      <form onSubmit={handleSubmit} className="formStyle">
        <input type="text" className="inputStyle" value={tenantName} onChange={(e) => setTenantName(e.target.value)}
               placeholder="Workspace Name" required autoFocus={true}/>
        <input type="text" className="inputStyle" value={tenantIdentifier}
               onChange={(e) => setTenantIdentifier(e.target.value)} placeholder="Workspace Code" required/>
        <hr width={"100%"}/>
        <input type="text" autoComplete={"name"} className="inputStyle" value={name}
               onChange={(e) => setName(e.target.value)} placeholder="Name" required/>
        <input type="email" name="email" autoComplete={"work email"} className="inputStyle" value={email}
               onChange={(e) => setEmail(e.target.value)} placeholder="Email" required/>
        <input type="text" name="username" autoComplete={"username"} className="inputStyle" value={username}
               onChange={(e) => setUsername(e.target.value)} placeholder="Username" required/>
        <input type="password" name="new-password" autoComplete={"new-password"} className="inputStyle" value={password}
               onChange={(e) => setPassword(e.target.value)} placeholder="Password" required/>
        <button type="submit" className="buttonStyle createWorkspaceButton">Create Workspace</button>
      </form>
    </div>
  );
};

export default InitialUserCreation;
