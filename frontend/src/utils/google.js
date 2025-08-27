import {toast} from 'react-toastify';

export const extractGoogleIdToken = (response) => {
  const idToken = response?.id_token ?? response?.credential;
  if (!idToken) {
    toast.error('No ID token received from Google');
    return null;
  }
  return idToken;
};
