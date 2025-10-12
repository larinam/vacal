import { render } from '@testing-library/react';
import App from './App';
import {AuthContext} from './contexts/AuthContext';
import {ConfigContext} from './contexts/ConfigContext';

test('app renders without crashing', () => {
  render(
    <AuthContext value={{isAuthenticated: false}}>
      <ConfigContext value={{
        isMultitenancyEnabled: false,
        isTelegramEnabled: false,
        telegramBotUsername: '',
        userInitiated: true,
        setUserInitiated: () => {},
        googleClientId: '',
        configLoaded: true,
      }}>
        <App />
      </ConfigContext>
    </AuthContext>
  );
});
