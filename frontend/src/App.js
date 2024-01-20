import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import MainComponent from './components/MainComponent';
import Login from './components/Login';
import './styles.css';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { isAuthenticated, handleLogin } = useAuth();
  const requiresBasicAuth = process.env.REACT_APP_REQUIRE_BASIC_AUTH === 'true';

  return (
    <Router>
      <Routes>
        {requiresBasicAuth && !isAuthenticated ? (
          <Route path="/" element={<Login onLogin={handleLogin} />} />
        ) : (
          <Route path="/" element={<MainComponent />} />
        )}
        {/* Additional routes */}
      </Routes>
    </Router>
  );
}

export default App;
