import React, {useEffect, useRef, useState} from 'react';
import QRCode from 'qrcode';
import './Login.css';
import {useAuth} from "../../contexts/AuthContext";
import {useNavigate} from "react-router-dom";
import {toast} from 'react-toastify';
import TelegramLogin from "./TelegramLogin";
import {useConfig} from "../../contexts/ConfigContext";

const Login = () => {
  const {handleLogin} = useAuth();
  const navigate = useNavigate();
  const {isMultitenancyEnabled, isTelegramEnabled, telegramBotUsername, userInitiated} = useConfig();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const formRef = useRef(null);

  const handleOtpChange = (e) => {
    const value = e.target.value;
    setOtp(value);
  };
  const [qrData, setQrData] = useState(null);
  const [step, setStep] = useState('credentials');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (otp.length === 6) {
      formRef.current?.requestSubmit();
    }
  }, [otp]);


  useEffect(() => {
    if (!userInitiated) {
      navigate('/create-initial-user')
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await handleLogin(username, password, otp);
    if (result?.otpUri) {
      const url = await QRCode.toDataURL(result.otpUri);
      setQrData(url);
      setStep('mfa-setup');
      setMessage('Scan this QR code with your authenticator app and enter the generated code.');
    } else if (result?.invalidOtp) {
      setStep('mfa');
      if (step === 'credentials') {
        setMessage('Please enter your one-time code.');
      } else {
        toast.error('Invalid one-time code.');
      }
    } else if (result?.success) {
      navigate('/');
    } else if (result?.error) {
      toast.error(result.error);
    } else {
      toast.error('Authentication failed');
    }
  };

  return (
    <div className="loginContainer">
      {isMultitenancyEnabled && (
        <button
          className="signUpButton"
          onClick={() => navigate('/create-initial-user')}
        >
          Sign up
        </button>
      )}
      <div className="loginCenter">
        <h1>Log in to Vacal</h1>
        <form ref={formRef} onSubmit={handleSubmit} className="formStyle">
          <input
            type="text"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="inputStyle"
            autoFocus={true}
          />
          <input
            type="password"
            name="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="inputStyle"
          />
          {step !== 'credentials' && (
            <>
              <input
                type="text"
                name="otp"
                value={otp}
                onChange={handleOtpChange}
                placeholder="One-time code"
                className="inputStyle"
                autoFocus={true}
              />
              {qrData && (
                <img src={qrData} alt="Scan QR code to setup MFA" className="qrImage" />
              )}
            </>
          )}
          {message && <div className="infoMessage">{message}</div>}
          <button type="submit" className="buttonStyle">Log in</button>
          <p
            className="forgotPasswordLink"
            onClick={() => navigate('/password-reset-request')}
          >
            Forgot password?
          </p>
        </form>
        {isTelegramEnabled && <TelegramLogin telegramBotUsername={telegramBotUsername}/>}
      </div>
    </div>
  );
};

export default Login;
