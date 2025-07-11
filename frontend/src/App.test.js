import { render } from '@testing-library/react';
import App from './App';
import {AuthContext} from './contexts/AuthContext';

test('app renders without crashing', () => {
  render(
    <AuthContext.Provider value={{isAuthenticated: false}}>
      <App />
    </AuthContext.Provider>
  );
});
