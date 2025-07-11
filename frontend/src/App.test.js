import { render } from '@testing-library/react';
import App from './App';
import {AuthContext} from './contexts/AuthContext';
import {ConfigContext} from './contexts/ConfigContext';

test('app renders without crashing', () => {
  render(
    <AuthContext.Provider value={{isAuthenticated: false}}>
      <ConfigContext.Provider value={{isMultitenancyEnabled: false, isTelegramEnabled: false, telegramBotUsername: '', userInitiated: true}}>
        <App />
      </ConfigContext.Provider>
    </AuthContext.Provider>
  );
});
