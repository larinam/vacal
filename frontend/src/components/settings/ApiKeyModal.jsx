import React, {useEffect, useState} from 'react';
import Modal from '../Modal';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';

const ApiKeyModal = ({isOpen, onClose}) => {
  const {apiCall} = useApi();
  const [apiKey, setApiKey] = useState('');
  const [isMasked, setIsMasked] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const fetchKey = async () => {
        try {
          const data = await apiCall('/users/me/api-key');
          setApiKey(data.api_key);
          setIsMasked(true);
        } catch (e) {
          console.error('Error fetching API key:', e);
          toast.error('Error fetching API key');
        }
      };
      fetchKey();
    }
  }, [isOpen]);

  const handleRegenerate = async () => {
    const confirmed = window.confirm('Regenerate API key?');
    if (!confirmed) return;
    try {
      const data = await apiCall('/users/me/api-key', 'POST');
      setApiKey(data.api_key);
      setIsMasked(false);
      toast.success('API key regenerated');
    } catch (e) {
      console.error('Error regenerating API key:', e);
      toast.error('Error regenerating API key');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      toast('API key copied to clipboard');
    } catch (e) {
      console.error('Failed to copy API key:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="apiKeyModal">
        <p>API Key: <span className="apiKey" style={{cursor: !isMasked ? 'pointer' : 'default'}} onClick={!isMasked ? handleCopy : undefined}>{apiKey}</span></p>
        <div className="button-container">
          {isMasked ? (
            <button type="button" onClick={handleRegenerate}>Regenerate</button>
          ) : (
            <button type="button" onClick={handleCopy}>Copy</button>
          )}
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
};

export default ApiKeyModal;
