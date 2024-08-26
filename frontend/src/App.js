import {BrowserRouter as Router, Navigate, Route, Routes} from 'react-router-dom';
import {ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainComponent from './components/MainComponent';
import Login from './components/auth/Login';
import InitialUserCreation from './components/auth/InitialUserCreation';
import UserRegistration from "./components/auth/UserRegistration";
import './styles.css';
import {useAuth} from './contexts/AuthContext';
import AdditionalWorkspaceCreation from "./components/auth/AdditionalWorkspaceCreation";


function App() {
  const {isAuthenticated} = useAuth();

  return (
    <Router>
      <Routes>
        <Route index element={
          !isAuthenticated ?
            <Navigate to="/login"/> :
            <Navigate to="/main"/>
        }/>
        <Route path="/login" element={<Login/>}/>
        <Route path="/create-initial-user" element={<InitialUserCreation/>}/>
        <Route path="/register/:token" element={<UserRegistration/>}/>
        <Route path="/create-additional-workspace" element={<AdditionalWorkspaceCreation/>}/>
        <Route path="/main/*" element={<MainComponent/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
      <ToastContainer/>
    </Router>
  );
}

export default App;
