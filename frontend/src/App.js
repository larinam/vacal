import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import MainComponent from './components/MainComponent';
import Login from './components/Login';
import './styles.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("isAuthenticated") === "true"
  );
  const [authHeader, setAuthHeader] = useState(localStorage.getItem("authHeader") || '');

  useEffect(() => {
    localStorage.setItem("isAuthenticated", isAuthenticated);
    localStorage.setItem("authHeader", authHeader);
  }, [isAuthenticated, authHeader]);

  const handleLogin = (username, password) => {
    const encodedCredentials = btoa(`${username}:${password}`);
    setAuthHeader(`Basic ${encodedCredentials}`);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthHeader('');
  };

  const requiresBasicAuth = process.env.REACT_APP_REQUIRE_BASIC_AUTH === 'true';

  return (
    <Router>
      <Routes>
        {requiresBasicAuth && !isAuthenticated ? (
          <Route path="/" element={<Login onLogin={handleLogin} />} />
        ) : (
          <Route path="/" element={<MainComponent authHeader={authHeader} onLogout={handleLogout} />} />
        )}
        {/* Additional routes can be added here */}
      </Routes>
    </Router>
  );
}

export default App;
