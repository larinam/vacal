import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {AuthProvider} from './contexts/AuthContext';
import {ConfigProvider, useConfig} from "./contexts/ConfigContext";
import {GoogleOAuthProvider} from '@react-oauth/google';


const root = ReactDOM.createRoot(document.getElementById('root'));

const AppProviders = () => {
  const {googleClientId, configLoaded} = useConfig();
  if (!configLoaded) {
    return null;
  }
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <App/>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

root.render(
  <React.StrictMode>
    <ConfigProvider>
      <AppProviders/>
    </ConfigProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
