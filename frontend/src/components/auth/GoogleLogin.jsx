import React from 'react';
import {useAuth} from "../../contexts/AuthContext";
import useGoogleAuth from "../../hooks/useGoogleAuth";
import './SocialLogin.css';

const GoogleLogin = () => {
  const {handleGoogleLogin} = useAuth();
  const googleLogin = useGoogleAuth(async (tokenResponse) => {
    await handleGoogleLogin(tokenResponse);
  });

  return (
    <div className="socialLoginContainer">
      <h3>Log in to your existing Vacal account with Google</h3>
      <button className="buttonStyle" onClick={() => googleLogin()}>Log in with Google</button>
    </div>
  );
};

export default GoogleLogin;
