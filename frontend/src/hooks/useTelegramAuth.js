import {useEffect, useRef} from 'react';

// Hook to embed Telegram login widget and handle authentication callback
const useTelegramAuth = (telegramBotUsername, onAuth) => {
  const widgetRef = useRef(null);

  useEffect(() => {
    if (!telegramBotUsername) return;
    // Set global callback expected by Telegram login widget
    window.onTelegramAuth = async (user) => {
      try {
        await onAuth(user);
      } finally {
        delete window.onTelegramAuth;
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', telegramBotUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    widgetRef.current.appendChild(script);

    return () => {
      if (widgetRef.current) {
        widgetRef.current.innerHTML = '';
      }
      delete window.onTelegramAuth;
    };
  }, [telegramBotUsername, onAuth]);

  return widgetRef;
};

export default useTelegramAuth;
