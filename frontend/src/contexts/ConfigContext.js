import React, {createContext, useContext, useEffect, useState} from 'react';
import {toast} from 'react-toastify';

export const ConfigContext = createContext();

export const ConfigProvider = ({children}) => {
  const [isMultitenancyEnabled, setIsMultitenancyEnabled] = useState(false);
  const [isTelegramEnabled, setIsTelegramEnabled] = useState(false);
  const [telegramBotUsername, setTelegramBotUsername] = useState('');
  const [userInitiated, setUserInitiated] = useState(true); // Default to true

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/config`);
        if (!response.ok) {
          throw new Error('Failed to fetch configuration');
        }
        const config = await response.json();
        setIsMultitenancyEnabled(config.multitenancy_enabled);
        setIsTelegramEnabled(config.telegram_enabled);
        setTelegramBotUsername(config.telegram_bot_username);
        setUserInitiated(config.user_initiated);
      } catch (error) {
        console.error('Error fetching configuration:', error);
        toast.error('Failed to load configuration');
      }
    };

    fetchConfig();
  }, []);

  return (
    <ConfigContext
      value={{
        isMultitenancyEnabled,
        isTelegramEnabled,
        telegramBotUsername,
        userInitiated,
        setUserInitiated,
      }}
    >
      {children}
    </ConfigContext>
  );
};

export const useConfig = () => useContext(ConfigContext);
