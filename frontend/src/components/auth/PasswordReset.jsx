import React, {useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';
import './Login.css';
import './InitialUserCreation.css';

const PasswordReset = () => {
  const {token} = useParams();
  const {apiCall} = useApi();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiCall(`/users/password-reset/${token}`, 'POST', {
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      toast.success('Password reset successfully');
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
      <button className="logInButton" onClick={() => navigate('/login')}>Log in</button>
      <div className="loginCenter">
        <h1>Set New Password</h1>
        <form onSubmit={handleSubmit} className="formStyle">
          <input type="password" name="new-password" autoComplete="new-password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="New password" className="inputStyle" required autoFocus />
          <input type="password" name="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} placeholder="Confirm password" className="inputStyle" required />
          <button type="submit" className="buttonStyle createWorkspaceButton">Reset Password</button>
        </form>
      </div>
    </div>
  );
};

export default PasswordReset;
