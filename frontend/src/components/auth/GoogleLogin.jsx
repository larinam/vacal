import React from 'react';
import {useAuth} from "../../contexts/AuthContext";
import {useNavigate} from "react-router-dom";
import useGoogleAuth from "../../hooks/useGoogleAuth";
import './SocialLogin.css';

const GoogleLogin = () => {
  const {handleGoogleLogin} = useAuth();
  const navigate = useNavigate();
  const googleLogin = useGoogleAuth(async (tokenResponse) => {
    const result = await handleGoogleLogin(tokenResponse);
    if (result?.success) {
      navigate('/');
    }
  });

  return (
    <div className="socialLoginContainer">
      <h3>Log in to your existing Vacal account with Google</h3>
      <button className="buttonStyle" onClick={() => googleLogin()}>Log in with Google</button>
    </div>
  );
};

export default GoogleLogin;
