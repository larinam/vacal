import {useGoogleLogin} from '@react-oauth/google';
import {toast} from 'react-toastify';

const useGoogleAuth = (onSuccess) => {
  return useGoogleLogin({
    scope: 'openid email profile',
    onSuccess,
    onError: (error) => {
      console.error('Google login failed', error);
      toast.error('Google login failed');
    }
  });
};

export default useGoogleAuth;
