import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useApi} from '../../hooks/useApi';

const InitialUserCreation = () => {
  const navigate = useNavigate();
  const { apiCall } = useApi();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiCall('/users/create-initial', 'POST', { name, email, username, password });
      navigate('/login');
    } catch (error) {
      console.error('Error creating initial user:', error);
    }
  };

  return (
    <div className="initialUserCreationContainer">
      <form onSubmit={handleSubmit} className="formStyle">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
        <button type="submit" className="buttonStyle">Create Initial User</button>
      </form>
    </div>
  );
};

export default InitialUserCreation;
