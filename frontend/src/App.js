import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import MainComponent from './components/MainComponent';
import Login from './components/Login';
import './styles.css';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Routes>
        <Route index element={
          !isAuthenticated ?
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
