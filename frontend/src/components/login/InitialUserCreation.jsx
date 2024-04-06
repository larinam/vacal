import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useApi} from '../../hooks/useApi';
import {toast} from "react-toastify";
import './InitialUserCreation.css';

const InitialUserCreation = () => {
  const navigate = useNavigate();
  const { apiCall } = useApi();
  const [tenantName, setTenantName] = useState('');
  const [tenantIdentifier, setTenantIdentifier] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tenant = { name: tenantName, identifier: tenantIdentifier };
    try {
      await apiCall('/users/create-initial', 'POST', { tenant, name, email, username, password });
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
      <form onSubmit={handleSubmit} className="formStyle">
        <input type="text" className="inputStyle" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Tenant Name" required />
        <input type="text" className="inputStyle" value={tenantIdentifier} onChange={(e) => setTenantIdentifier(e.target.value)} placeholder="Tenant Identifier" required />
        <hr width={"100%"}/>
        <input type="text" className="inputStyle" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        <input type="email" className="inputStyle" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input type="text" className="inputStyle" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
        <input type="password" className="inputStyle"value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
        <button type="submit" className="buttonStyle">Create Initial User</button>
      </form>
    </div>
  );
};

export default InitialUserCreation;
