import React from 'react';
import {useAuth} from "../../contexts/AuthContext";
import {useNavigate} from "react-router-dom";
import {GoogleLogin as GoogleLoginButton} from '@react-oauth/google';
import {toast} from 'react-toastify';
import './SocialLogin.css';

const GoogleLogin = () => {
  const {handleGoogleLogin} = useAuth();
  const navigate = useNavigate();

  const onSuccess = async (credentialResponse) => {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      toast.error('No ID token received from Google');
      return;
    }
    const result = await handleGoogleLogin({id_token: idToken});
    if (result?.success) {
      navigate('/');
    }
  };

  const onError = () => {
    toast.error('Google login failed');
  };

  return (
    <div className="socialLoginContainer">
      <h3>Log in to your existing Vacal account with Google</h3>
      <GoogleLoginButton onSuccess={onSuccess} onError={onError}/>
    </div>
  );
};

export default GoogleLogin;
