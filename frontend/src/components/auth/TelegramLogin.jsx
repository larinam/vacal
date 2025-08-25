import React, {useEffect, useRef} from 'react';
import {useAuth} from "../../contexts/AuthContext";
import {useNavigate} from "react-router-dom";
import './SocialLogin.css';


const TelegramLogin = ({telegramBotUsername}) => {
  const telegramWidgetRef = useRef(null);
  const {handleTelegramLogin} = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Define the onTelegramAuth function
    window.onTelegramAuth = async (user) => {
      const result = await handleTelegramLogin(user);
      if (result?.success) {
        navigate('/');
      }
    };

    const script = document.createElement('script');
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute('data-telegram-login', telegramBotUsername);
    script.setAttribute('data-size', "large");
    script.setAttribute('data-onauth', "onTelegramAuth(user)");
    script.setAttribute('data-request-access', "write");
    script.async = true;

    // Append the script to the ref element
    telegramWidgetRef.current.appendChild(script);

    return () => {
      if (telegramWidgetRef.current) {
        telegramWidgetRef.current.removeChild(script);
      }
      delete window.onTelegramAuth;
    };
  }, []);

  return (
    <div className="socialLoginContainer">
      <h3>Log in to your existing Vacal account with Telegram</h3>
      <div ref={telegramWidgetRef}></div>
    </div>
  );
};

export default TelegramLogin;
