import React, {useEffect, useRef} from 'react';
import {useAuth} from "../../contexts/AuthContext";
import {useNavigate} from "react-router-dom";


const TelegramLogin = () => {
  const telegramWidgetRef = useRef(null);
  const { handleTelegramLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Define the onTelegramAuth function
    window.onTelegramAuth = async (user) => {
      await handleTelegramLogin(user);
      navigate('/');
    };

    const script = document.createElement('script');
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute('data-telegram-login', "VacalBot");
    script.setAttribute('data-size', "large");
    script.setAttribute('data-onauth', "onTelegramAuth(user)");
    script.setAttribute('data-request-access', "write");
    script.async = true;

    // Append the script to the ref element
    telegramWidgetRef.current.appendChild(script);
  }, []);

  return (
    <div>
      <div ref={telegramWidgetRef}></div>
    </div>
  );
};

export default TelegramLogin;
