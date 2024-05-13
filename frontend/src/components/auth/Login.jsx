import React, {useEffect, useState} from 'react';
import './Login.css';
import {useAuth} from "../../contexts/AuthContext";
import {useNavigate} from "react-router-dom";
import TelegramLogin from "./TelegramLogin";
import {useApi} from "../../hooks/useApi";

const Login = () => {
  const {handleLogin} = useAuth();
  const navigate = useNavigate();
  const {apiCall} = useApi();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isMultitenancyEnabled, setIsMultitenancyEnabled] = useState(false);
  const [isTelegramEnabled, setIsTelegramEnabled] = useState(false);
  const [telegramBotUsername, setTelegramBotUsername] = useState('');


  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await apiCall('/config');
        setIsTelegramEnabled(config.telegram_enabled);
        setIsMultitenancyEnabled(config.multitenancy_enabled);
        setTelegramBotUsername(config.telegram_bot_username);
        if (!config.user_initiated) {
          navigate('/create-initial-user')
        }
      } catch (error) {
        console.error('Error fetching configuration:', error);
      }
    };

    fetchConfig();
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
        {isTelegramEnabled && <TelegramLogin telegramBotUsername={telegramBotUsername}/>}
      </div>
    </div>
  );
};

export default Login;
