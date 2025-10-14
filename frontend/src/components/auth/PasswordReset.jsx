import React, {useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';
import './Login.css';
import './InitialUserCreation.css';
import {useMutation} from '@tanstack/react-query';

const PasswordReset = () => {
  const {token} = useParams();
  const {apiCall} = useApi();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const resetPasswordMutation = useMutation({
    mutationFn: (payload) => apiCall(`/users/password-reset/${token}`, 'POST', payload),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    resetPasswordMutation.mutate(
      {
        new_password: newPassword,
        confirm_password: confirmPassword,
      },
      {
        onSuccess: () => {
          toast.success('Password reset successfully');
          navigate('/login');
        },
        onError: (error) => {
          if (error?.data?.detail) {
            toast.error(error.data.detail);
          } else {
            toast.error('An error occurred. Please try again.');
          }
        },
      },
    );
  };

  return (
    <div className="loginContainer">
      <button className="logInButton" onClick={() => navigate('/login')}>Log in</button>
      <div className="loginCenter">
        <h1>Set New Password</h1>
        <form onSubmit={handleSubmit} className="formStyle">
          <input type="password" name="new-password" autoComplete="new-password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="New password" className="inputStyle" required autoFocus />
          <input type="password" name="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} placeholder="Confirm password" className="inputStyle" required />
          <button type="submit" className="buttonStyle createWorkspaceButton" disabled={resetPasswordMutation.isPending}>
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordReset;
