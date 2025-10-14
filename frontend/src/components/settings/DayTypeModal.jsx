import React, {useEffect, useState} from 'react';
import {toast} from 'react-toastify';
import {useApi} from '../../hooks/useApi';
import './DayTypeModal.css';
import Modal from '../Modal';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {DAY_TYPES_QUERY_KEY} from '../../hooks/queries/useDayTypesQuery';

const DEFAULT_FORM_STATE = {
  name: '',
  identifier: '',
  color: '',
  is_absence: false,
};

const DayTypeModal = ({isOpen, onClose, editingDayType}) => {
  const [dayTypeData, setDayTypeData] = useState(DEFAULT_FORM_STATE);
  const {apiCall} = useApi();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (editingDayType) {
      setDayTypeData({
        name: editingDayType.name,
        identifier: editingDayType.identifier,
        color: editingDayType.color,
        is_absence: editingDayType.is_absence,
      });
    } else {
      setDayTypeData(DEFAULT_FORM_STATE);
    }
  }, [editingDayType]);

  const dayTypeMutation = useMutation({
    mutationFn: ({method, url, payload}) => apiCall(url, method, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({queryKey: DAY_TYPES_QUERY_KEY});
      if (variables.successMessage) {
        toast.success(variables.successMessage);
      }
      setDayTypeData(DEFAULT_FORM_STATE);
      onClose();
    },
    onError: (error) => {
      console.error('Error saving day type:', error);
      toast.error('Error saving day type');
    },
  });

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const method = editingDayType ? 'PUT' : 'POST';
    const url = editingDayType ? `/daytypes/${editingDayType._id}` : '/daytypes';
    const successMessage = editingDayType
      ? 'Day type updated successfully'
      : 'Day type created successfully';

    dayTypeMutation.mutate({method, url, payload: dayTypeData, successMessage});
  };

  const handleChange = (e) => {
    const {name, type, checked, value} = e.target;
    setDayTypeData((prev) => ({...prev, [name]: type === 'checkbox' ? checked : value}));
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleFormSubmit}>
        <input
          autoFocus={true}
          type="text"
          name="name"
          value={dayTypeData.name}
          onChange={handleChange}
          placeholder="Day Type Name"
          required
        />
        <input
          type="text"
          name="identifier"
          value={dayTypeData.identifier}
          onChange={handleChange}
          placeholder="Day Type Identifier"
          required
        />
        <div className="color-input-container">
          <input
            type="text"
            name="color"
            value={dayTypeData.color}
            onChange={handleChange}
            placeholder="Day Type Color"
          />
          <input
            type="color"
            name="color"
            value={dayTypeData.color}
            onChange={handleChange}
            className="color-picker"
          />
        </div>
        <label className="form-checkbox">
          <input
            type="checkbox"
            name="is_absence"
            checked={dayTypeData.is_absence}
            onChange={handleChange}
          />
          <span>Absence</span>
        </label>
        <div className="button-container">
          <button type="submit" disabled={dayTypeMutation.isPending}>
            {editingDayType ? 'Update' : 'Add'} Day Type
          </button>
          <button type="button" onClick={onClose} disabled={dayTypeMutation.isPending}>
            Close
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default DayTypeModal;
