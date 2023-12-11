import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import MainComponent from './components/MainComponent';
import Login from './components/Login';
import './styles.css';
import { AUTH_TOKEN_KEY } from "./consts";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem(AUTH_TOKEN_KEY));
  const [authHeader, setAuthHeader] = useState('');

  const handleLogin = (username, password) => {
    const encodedCredentials = btoa(`${username}:${password}`);
    const token = `Basic ${encodedCredentials}`;
    sessionStorage.setItem(AUTH_TOKEN_KEY, token)
    setAuthHeader(token);
    setIsAuthenticated(true);
    // Additional logic for handling login can be added here
  };

  useEffect(() => {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);

    if (token) {
      setAuthHeader(token);
    } else {

    }
  }, []);

  // Check the updated environment variable
  const requiresBasicAuth = process.env.REACT_APP_REQUIRE_BASIC_AUTH === 'true';

  return (
    <Router>
      <Routes>
        {requiresBasicAuth && !isAuthenticated ? (
          <Route path="/" element={<Login onLogin={handleLogin} />} />
        ) : (
          <Route path="/" element={<MainComponent authHeader={authHeader} />} />
        )}
        {/* Additional routes can be added here */}
      </Routes>
    </Router>
  );
}

export default App;
