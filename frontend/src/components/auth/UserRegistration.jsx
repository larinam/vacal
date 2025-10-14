import React, {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';
import './InitialUserCreation.css';
import {useMutation, useQuery} from '@tanstack/react-query';

const UserRegistration = () => {
  const navigate = useNavigate();
  const {token} = useParams();
  const {apiCall} = useApi();
  const [tenantName, setTenantName] = useState('');
  const [tenantIdentifier, setTenantIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [existingUser, setExistingUser] = useState(false);

  const {
    data: inviteData,
    isLoading: isInviteLoading,
    error: inviteError,
  } = useQuery({
    queryKey: ['inviteDetails', token],
    queryFn: ({signal}) => apiCall(`/users/invite/${token}`, 'GET', null, false, signal),
    enabled: Boolean(token),
    retry: false,
  });

  const registrationMutation = useMutation({
    mutationFn: (payload) => apiCall(`/users/register/${token}`, 'POST', payload),
  });

  useEffect(() => {
    if (inviteData) {
      setTenantName(inviteData.tenant_name);
      setTenantIdentifier(inviteData.tenant_identifier);
      setEmail(inviteData.email);
      setExistingUser(Boolean(inviteData.existing_user));
    }
  }, [inviteData]);

  useEffect(() => {
    if (inviteError) {
      console.error('Error fetching invite details:', inviteError);
      toast.error('Invalid or expired invitation link.');
      navigate('/login');
    }
  }, [inviteError, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    registrationMutation.mutate(
      {
        name,
        email,
        username,
        password,
      },
      {
        onSuccess: (data) => {
          toast.success(data?.message ?? 'Registration successful');
          navigate('/login');
        },
        onError: (error) => {
          console.error('Error registering user:', error);
          const detail = error?.data?.detail;
          toast.error(detail ?? 'An error occurred. Please try again.');
        },
      },
    );
  };

  return (
    <div className="initialUserCreationContainer">
      <h1>{existingUser ? 'User Already Exists' : 'Register Your Account'}</h1>
      <button className="logInButton" onClick={() => navigate('/login')}>
        Log in
      </button>
      {isInviteLoading ? (
        <div className="existingUserMessage">Loading invitation…</div>
      ) : existingUser ? (
        <div className="existingUserMessage">
          <p>A user with email {email} already exists in the system.</p>
          <p>
            You can accept the invitation to join the workspace with the name "{tenantName}" and identifier "
            {tenantIdentifier}".
          </p>
          <form onSubmit={handleSubmit} className="formStyle">
            <button
              type="submit"
              className="buttonStyle createWorkspaceButton"
              disabled={registrationMutation.isPending}
            >
              Accept invite
            </button>
          </form>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="formStyle">
          <input type="text" className="inputStyle" value={tenantName} disabled placeholder="Workspace Name" required />
          <input
            type="text"
            className="inputStyle"
            value={tenantIdentifier}
            disabled
            placeholder="Workspace Code"
            required
          />
          <hr width="100%" />
          <input
            type="text"
            autoComplete="name"
            className="inputStyle"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            autoFocus
          />
          <input type="email" name="email" className="inputStyle" value={email} disabled placeholder="Email" required />
          <input
            type="text"
            name="username"
            autoComplete="username"
            className="inputStyle"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
          />
          <input
            type="password"
            name="new-password"
            autoComplete="new-password"
            className="inputStyle"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
          <button
            type="submit"
            className="buttonStyle createWorkspaceButton"
            disabled={registrationMutation.isPending}
          >
            Register
          </button>
        </form>
      )}
    </div>
  );
};

export default UserRegistration;
