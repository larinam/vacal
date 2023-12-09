import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import MainComponent from './components/MainComponent';
import Login from './components/Login';
import './styles.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authHeader, setAuthHeader] = useState('');

  const handleLogin = (username, password) => {
    const encodedCredentials = btoa(`${username}:${password}`);
    setAuthHeader(`Basic ${encodedCredentials}`);
    setIsAuthenticated(true);
    // Additional logic for handling login can be added here
  };

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
