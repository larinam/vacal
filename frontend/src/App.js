import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import MainComponent from './components/MainComponent';
import Login from './components/Login';
import './styles.css';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { isAuthenticated } = useAuth();
  const requiresBasicAuth = process.env.REACT_APP_REQUIRE_BASIC_AUTH === 'true';

  return (
    <Router>
      <Routes>
        <Route index element={
          requiresBasicAuth && !isAuthenticated ?
          <Navigate to="/login" /> :
          <Navigate to="/main" />
        } />
        <Route path="/login" element={<Login />} />
        <Route path="/main/*" element={<MainComponent />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
