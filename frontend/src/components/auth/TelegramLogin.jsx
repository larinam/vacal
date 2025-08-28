import React from 'react';
import {useAuth} from "../../contexts/AuthContext";
import {useNavigate} from "react-router-dom";
import useTelegramAuth from '../../hooks/useTelegramAuth';
import './SocialLogin.css';

// Reusable Telegram authentication widget
const TelegramLogin = ({telegramBotUsername, onAuth, title = 'Log in to your existing Vacal account with Telegram'}) => {
  const {handleTelegramLogin} = useAuth();
  const navigate = useNavigate();

  const defaultOnAuth = async (user) => {
    const result = await handleTelegramLogin(user);
    if (result?.success) {
      navigate('/');
    }
  };

  const widgetRef = useTelegramAuth(telegramBotUsername, onAuth || defaultOnAuth);

  return (
    <div className="socialLoginContainer">
      <h3>{title}</h3>
      <div ref={widgetRef}></div>
    </div>
  );
};

export default TelegramLogin;
