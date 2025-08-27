import {useCallback} from 'react';
import {useGoogleOAuth} from '@react-oauth/google';
import {toast} from 'react-toastify';
import {extractGoogleIdToken} from '../utils/google';

// Custom hook that triggers Google Identity Services and returns an ID token.
// On success it calls the supplied callback with an object containing `id_token`.
const useGoogleAuth = (onSuccess) => {
  const {clientId, scriptLoadedSuccessfully} = useGoogleOAuth();

  return useCallback(() => {
    if (!scriptLoadedSuccessfully || !(window.google && window.google.accounts && window.google.accounts.id)) {
      toast.error('Google login failed');
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      callback: (response) => {
        const idToken = extractGoogleIdToken(response);
        if (!idToken) {
          return;
        }
        onSuccess({id_token: idToken});
      },
    });

    window.google.accounts.id.prompt();
  }, [clientId, scriptLoadedSuccessfully, onSuccess]);
};

export default useGoogleAuth;
