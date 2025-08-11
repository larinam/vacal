import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';
import './Login.css';
import './InitialUserCreation.css';

const PasswordResetRequest = () => {
  const {apiCall} = useApi();
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiCall('/users/password-reset/request', 'POST', {email});
      toast.success('If the email is registered, you will receive a password reset email');
      navigate('/login');
    } catch (error) {
      if (error.data && error.data.detail) {
        toast.error(error.data.detail);
      } else {
        toast.error('An error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="loginContainer">
      <button className="logInButton" onClick={() => navigate('/login')}>
        Log in
      </button>
      <div className="loginCenter">
        <h1>Reset Password</h1>
        <form onSubmit={handleSubmit} className="formStyle">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="inputStyle"
            required
            autoFocus
          />
          <button type="submit" className="buttonStyle">Send reset link</button>
        </form>
      </div>
    </div>
  );
};

export default PasswordResetRequest;
