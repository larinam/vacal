import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {AuthProvider} from './contexts/AuthContext';
import {ConfigProvider, useConfig} from "./contexts/ConfigContext";
import {GoogleOAuthProvider} from '@react-oauth/google';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';
import ErrorBoundary from './components/ErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root'));
const queryClient = new QueryClient();

const AppProviders = () => {
  const {googleClientId, configLoaded} = useConfig();
  if (!configLoaded) {
    return null;
  }
  if (!googleClientId) {
    return (
      <ErrorBoundary>
        <AuthProvider>
          <App/>
        </AuthProvider>
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={googleClientId}>
        <AuthProvider>
          <App/>
        </AuthProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
};

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <AppProviders/>
      </ConfigProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
