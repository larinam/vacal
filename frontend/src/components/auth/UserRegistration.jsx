import React, {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useApi} from '../../hooks/useApi';
import {toast} from "react-toastify";
import './InitialUserCreation.css';

const UserRegistration = () => {
  const navigate = useNavigate();
  const {token} = useParams();  // Get the token from the URL
  const {apiCall} = useApi();
  const [tenantName, setTenantName] = useState('');
  const [tenantIdentifier, setTenantIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [existingUser, setExistingUser] = useState(false);

  useEffect(() => {
    const fetchInviteDetails = async () => {
      try {
        const data = await apiCall(`/users/invite/${token}`, 'GET');
        setTenantName(data.tenant_name);
        setTenantIdentifier(data.tenant_identifier);
        setEmail(data.email);
        setExistingUser(data.existing_user);
      } catch (error) {
        console.error('Error fetching invite details:', error);
        toast.error("Invalid or expired invitation link.");
        navigate('/login');
      }
    };
    fetchInviteDetails();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await apiCall(`/users/register/${token}`, 'POST', {
        name,
        email,
        username,
        password
      });
      toast.success(data.message);
      navigate('/login');
    } catch (error) {
      console.error('Error registering user:', error);
      toast.error("An error occurred. Please try again.");
    }
  };


  return (
    <div className="initialUserCreationContainer">
      <h1>{existingUser ? 'User Already Exists' : 'Register Your Account'}</h1>
      <button
        className="logInButton"
        onClick={() => navigate('/login')}
      >
        Log in
      </button>
      {existingUser ? (
        <div className="existingUserMessage">
          <p>A user with email {email} already exists in the system.</p>
          <p>You can accept the invitation to join the workspace with the name "{tenantName}" and identifier
            "{tenantIdentifier}".</p>
          <form onSubmit={handleSubmit} className="formStyle">
            <button type="submit" className="buttonStyle createWorkspaceButton">Accept invite</button>
          </form>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="formStyle">
          <input type="text" className="inputStyle" value={tenantName} disabled placeholder="Workspace Name" required/>
          <input type="text" className="inputStyle" value={tenantIdentifier} disabled placeholder="Workspace Code"
                 required/>
          <hr width={"100%"}/>
          <input type="text" autoComplete={"name"} className="inputStyle" value={name}
                 onChange={(e) => setName(e.target.value)} placeholder="Name" required autoFocus/>
          <input type="email" name="email" className="inputStyle" value={email} disabled placeholder="Email" required/>
          <input type="text" name="username" autoComplete={"username"} className="inputStyle" value={username}
                 onChange={(e) => setUsername(e.target.value)} placeholder="Username" required/>
          <input type="password" name="new-password" autoComplete={"new-password"} className="inputStyle"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)} placeholder="Password" required/>
          <button type="submit" className="buttonStyle createWorkspaceButton">Register</button>
        </form>
      )}
    </div>
  );
};

export default UserRegistration;
