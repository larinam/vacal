import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';
import './AdditionalWorkspaceCreation.css';
import {useAuth} from "../../contexts/AuthContext";
import {useMutation} from '@tanstack/react-query';

const AdditionalWorkspaceCreation = () => {
  const navigate = useNavigate();
  const {apiCall} = useApi();
  const [tenantName, setTenantName] = useState('');
  const [tenantIdentifier, setTenantIdentifier] = useState('');
  const {setCurrentTenant} = useAuth();
  const createTenantMutation = useMutation({
    mutationFn: (tenantData) => apiCall('/users/create-tenant', 'POST', tenantData),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const tenantData = {name: tenantName, identifier: tenantIdentifier};
    createTenantMutation.mutate(tenantData, {
      onSuccess: () => {
        toast.success('Workspace created successfully');
        setCurrentTenant(tenantIdentifier);
        navigate('/main');
      },
      onError: (error) => {
        console.error('Error creating workspace:', error);
        if (error?.data?.detail) {
          toast.error(error.data.detail);
        } else {
          toast.error('An error occurred. Please try again.');
        }
      },
    });
  };

  return (
    <div className="additionalWorkspaceCreationContainer">
      <h1>Create a New Workspace</h1>
      <form onSubmit={handleSubmit} className="formStyle">
        <input
          type="text"
          className="inputStyle"
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
          placeholder="Workspace Name"
          required
          autoFocus={true}
        />
        <input
          type="text"
          className="inputStyle"
          value={tenantIdentifier}
          onChange={(e) => setTenantIdentifier(e.target.value)}
          placeholder="Workspace Code"
          required
        />
        <button type="submit" className="buttonStyle createWorkspaceButton" disabled={createTenantMutation.isPending}>
          Create Workspace
        </button>
      </form>
    </div>
  );
};

export default AdditionalWorkspaceCreation;
