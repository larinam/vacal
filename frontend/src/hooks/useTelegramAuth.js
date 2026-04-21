import {useEffect, useRef} from 'react';

// Hook to embed Telegram login widget and handle authentication callback.
// Self-heals when the browser discards the widget iframe after long tab
// inactivity (e.g. Chrome Memory Saver / bfcache restore): when the tab
// becomes visible again and the iframe is missing, the widget script is
// re-injected automatically so the user does not need to refresh manually.
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

    const injectWidget = () => {
      const container = widgetRef.current;
      if (!container) return;
      container.innerHTML = '';

      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', telegramBotUsername);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      script.async = true;
      container.appendChild(script);
    };

    const isWidgetMissing = () => {
      const container = widgetRef.current;
      if (!container) return false;
      const iframe = container.querySelector('iframe');
      if (!iframe) return true;
      try {
        // Detached/discarded iframes have no contentWindow
        if (!iframe.contentWindow) return true;
      } catch (_) {
        return true;
      }
      return false;
    };

    const reinjectIfNeeded = () => {
      if (isWidgetMissing()) {
        injectWidget();
      }
    };

    injectWidget();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reinjectIfNeeded();
      }
    };

    const handlePageShow = (event) => {
      // event.persisted === true means the page was restored from bfcache,
      // where the detached widget iframe is typically unusable.
      if (event && event.persisted) {
        reinjectIfNeeded();
      } else {
        reinjectIfNeeded();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      if (widgetRef.current) {
        widgetRef.current.innerHTML = '';
      }
      delete window.onTelegramAuth;
    };
  }, [telegramBotUsername, onAuth]);

  return widgetRef;
};

export default useTelegramAuth;
