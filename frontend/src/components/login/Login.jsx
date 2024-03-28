import React, {useState} from 'react';
import './Login.css';
import {useAuth} from "../../contexts/AuthContext";
import {useNavigate} from "react-router-dom";
import TelegramLogin from "./TelegramLogin";

const Login = () => {
  const { handleLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await handleLogin(username, password);
    navigate('/');
  };

  return (
    <div className="loginContainer">
      <form onSubmit={handleSubmit} className="formStyle">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="inputStyle"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="inputStyle"
        />
        <button type="submit" className="buttonStyle">Login</button>
      </form>
      <TelegramLogin />
    </div>
  );
};

export default Login;
