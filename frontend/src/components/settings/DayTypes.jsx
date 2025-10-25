import React, {useEffect, useState} from 'react';
import FontAwesomeIconWithTitle from '../FontAwesomeIconWithTitle';
import {faEdit, faTrashAlt} from '@fortawesome/free-solid-svg-icons';
import './DayTypes.css';
import {useApi} from '../../hooks/useApi';
import {toast} from 'react-toastify';
import DayTypeModal from './DayTypeModal';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {DAY_TYPES_QUERY_KEY, useDayTypesQuery} from '../../hooks/queries/useDayTypesQuery';

const DayTypes = () => {
  const [showDayTypeModal, setShowDayTypeModal] = useState(false);
  const [editingDayType, setEditingDayType] = useState(null);
  const {apiCall} = useApi();
  const queryClient = useQueryClient();

  const {
    data: dayTypes = [],
    isPending: isDayTypesPending,
    error: dayTypesError,
  } = useDayTypesQuery(apiCall);

  const deleteDayTypeMutation = useMutation({
    mutationFn: (dayTypeId) => apiCall(`/daytypes/${dayTypeId}`, 'DELETE'),
    onSuccess: () => {
      toast.success('Day type deleted successfully');
      queryClient.invalidateQueries({queryKey: DAY_TYPES_QUERY_KEY});
    },
    onError: (error) => {
      console.error('Error deleting day type:', error);
      toast.error('Error deleting day type');
    },
  });

  useEffect(() => {
    if (dayTypesError) {
      console.error('Error fetching day types:', dayTypesError);
      toast.error('Failed to load day types');
    }
  }, [dayTypesError]);

  const handleAddDayTypeClick = () => {
    setEditingDayType(null);
    setShowDayTypeModal(true);
  };

  const handleEditDayTypeClick = (dayType) => {
    setEditingDayType(dayType);
    setShowDayTypeModal(true);
  };

  const handleDeleteDayType = (dayTypeId) => {
    if (deleteDayTypeMutation.isPending) {
      return;
    }

    const isConfirmed = window.confirm('Are you sure you want to delete this day type?');
    if (isConfirmed) {
      deleteDayTypeMutation.mutate(dayTypeId);
    }
  };

  const handleModalClose = () => {
    setShowDayTypeModal(false);
    setEditingDayType(null);
  };

  const isInitialLoading = isDayTypesPending && dayTypes.length === 0;

  return (
    <div className="settingsDayTypesContainer">
      <h2>Day Types Settings</h2>
      <button onClick={handleAddDayTypeClick}>Add Day Type</button>
      <table className="settingsTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Identifier</th>
            <th>Color</th>
            <th>Absence</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isInitialLoading ? (
            <tr>
              <td colSpan={5}>Loading...</td>
            </tr>
          ) : dayTypes.length === 0 ? (
            <tr>
              <td colSpan={5}>No day types found.</td>
            </tr>
          ) : (
            dayTypes.map((dayType) => (
              <tr key={dayType._id}>
                <td>{dayType.name}</td>
                <td>{dayType.identifier}</td>
                <td>
                  <div className="colorCircle" style={{backgroundColor: dayType.color}}></div>
                  {dayType.color}
                </td>
                <td>{dayType.is_absence ? 'Yes' : 'No'}</td>
                <td>
                  <FontAwesomeIconWithTitle
                    icon={faEdit}
                    onClick={() => handleEditDayTypeClick(dayType)}
                    className="firstActionIcon"
                    title="Edit day type"
                    aria-label="Edit day type"
                  />
                  <FontAwesomeIconWithTitle
                    icon={faTrashAlt}
                    onClick={() => handleDeleteDayType(dayType._id)}
                    className="actionIcon"
                    title="Delete day type"
                    aria-label="Delete day type"
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {showDayTypeModal && (
        <DayTypeModal
          isOpen={showDayTypeModal}
          onClose={handleModalClose}
          editingDayType={editingDayType}
        />
      )}
    </div>
  );
};

export default DayTypes;
