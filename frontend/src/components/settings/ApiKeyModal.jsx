import React, {useEffect, useState} from 'react';
import Modal from '../Modal';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

const API_KEY_QUERY_KEY = ['currentUserApiKey'];

const ApiKeyModal = ({isOpen, onClose}) => {
  const {apiCall} = useApi();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [isMasked, setIsMasked] = useState(true);

  const {
    data,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: API_KEY_QUERY_KEY,
    queryFn: ({signal}) => apiCall('/users/me/api-key', 'GET', null, false, signal),
    enabled: Boolean(isOpen),
    cacheTime: 0,
    staleTime: 0,
  });

  const regenerateApiKeyMutation = useMutation({
    mutationFn: () => apiCall('/users/me/api-key', 'POST'),
    onSuccess: (payload) => {
      queryClient.setQueryData(API_KEY_QUERY_KEY, payload);
    },
  });

  useEffect(() => {
    if (data?.api_key) {
      setApiKey(data.api_key);
      setIsMasked(true);
    }
  }, [data]);

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const handleRegenerate = () => {
    const confirmed = window.confirm('Regenerate API key?');
    if (!confirmed) return;

    regenerateApiKeyMutation.mutate(undefined, {
      onSuccess: (payload) => {
        const newKey = payload?.api_key ?? '';
        setApiKey(newKey);
        setIsMasked(false);
        toast.success('API key regenerated');
      },
      onError: (error) => {
        console.error('Error regenerating API key:', error);
        toast.error('Error regenerating API key');
      },
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      toast('API key copied to clipboard');
    } catch (error) {
      console.error('Failed to copy API key:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="apiKeyModal">
        {isLoading ? (
          <p>Loading API key…</p>
        ) : (
          <p>
            API Key:{' '}
            <span
              className="apiKey"
              style={{cursor: !isMasked ? 'pointer' : 'default'}}
              onClick={!isMasked ? handleCopy : undefined}
            >
              {apiKey}
            </span>
          </p>
        )}
        <div className="button-container">
          <button type="button" onClick={onClose}>
            Close
          </button>
          {isMasked ? (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerateApiKeyMutation.isPending || isLoading}
            >
              Regenerate
            </button>
          ) : (
            <button type="button" onClick={handleCopy} disabled={!apiKey}>
              Copy
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ApiKeyModal;
