import React, {useEffect, useState} from 'react';
import './Login.css';
import {useAuth} from "../../contexts/AuthContext";
import {useNavigate} from "react-router-dom";
import TelegramLogin from "./TelegramLogin";
import {useConfig} from "../../contexts/ConfigContext";

const Login = () => {
  const {handleLogin} = useAuth();
  const navigate = useNavigate();
  const {isMultitenancyEnabled, isTelegramEnabled, telegramBotUsername, userInitiated} = useConfig();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');


  useEffect(() => {
    if (!userInitiated) {
      navigate('/create-initial-user')
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await handleLogin(username, password);
    navigate('/');
  };

  return (
    <div className="loginContainer">
      {isMultitenancyEnabled && (
        <button
          className="signUpButton"
          onClick={() => navigate('/create-initial-user')}
        >
          Sign up
        </button>
      )}
      <div className="loginCenter">
        <h1>Log in to Vacal</h1>
        <form onSubmit={handleSubmit} className="formStyle">
          <input
            type="text"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="inputStyle"
            autoFocus={true}
          />
          <input
            type="password"
            name="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="inputStyle"
          />
          <button type="submit" className="buttonStyle">Log in</button>
        </form>
        <p style={{cursor: 'pointer', marginTop: '10px'}} onClick={() => navigate('/password-reset-request')}>Forgot password?</p>
        {isTelegramEnabled && <TelegramLogin telegramBotUsername={telegramBotUsername}/>}
      </div>
    </div>
  );
};

export default Login;
