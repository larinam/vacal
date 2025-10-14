import React, {useEffect, useState} from 'react';
import {toast} from "react-toastify";
import Modal from './Modal';
import useMemberMutations from '../hooks/mutations/useMemberMutations';

const MemberModal = ({isOpen, onClose, selectedTeamId, updateTeamData, editingMember}) => {
  const INITIAL_MEMBER_STATE = {
    name: '',
    country: '',
    email: '',
    phone: '',
    birthday: '',
    employee_start_date: '',
    yearly_vacation_days: '',
    vac_days: []
  };
  const [newMemberData, setNewMemberData] = useState(INITIAL_MEMBER_STATE);
  const {createMemberMutation, updateMemberMutation} = useMemberMutations();

  useEffect(() => {
    if (editingMember) {
      setNewMemberData(editingMember);
    } else {
      setNewMemberData(INITIAL_MEMBER_STATE);
    }
  }, [editingMember]);

  const handleMemberErrorToast = (error) => {
    console.error('Error adding/modifying team member:', error);
    const detail = error?.data?.detail;
    if (Array.isArray(detail) && detail[0]?.msg) {
      toast.error(detail[0].msg);
      return;
    }
    if (detail?.msg) {
      toast.error(detail.msg);
      return;
    }
    if (detail) {
      toast.error(detail);
      return;
    }
    toast.error('An error occurred. Please try again.');
  };

  const handleAddMemberFormSubmit = (e) => {
    e.preventDefault();
    if (!selectedTeamId) {
      toast.error('Team is not selected');
      return;
    }
    const method = editingMember ? 'PUT' : 'POST';
    const mutation = method === 'POST' ? createMemberMutation : updateMemberMutation;
    const variables = method === 'POST'
      ? {teamId: selectedTeamId, payload: newMemberData}
      : {teamId: selectedTeamId, memberId: editingMember.uid, payload: newMemberData};

    mutation.mutate(variables, {
      onSuccess: () => {
        toast.success(editingMember ? 'Member updated successfully' : 'Member added successfully');
        setNewMemberData(INITIAL_MEMBER_STATE);
        if (updateTeamData) {
          updateTeamData();
        }
        onClose();
      },
      onError: handleMemberErrorToast,
    });
  };

  const isPending =
    createMemberMutation.isPending || updateMemberMutation.isPending;

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
        <form onSubmit={handleAddMemberFormSubmit}>
          <label>
            Name
            <input
              type="text"
              value={newMemberData.name}
              onChange={(e) => setNewMemberData({...newMemberData, name: e.target.value})}
              placeholder="Enter member's name"
              required
            />
          </label>
          <label>
            Country
            <input
              type="text"
              value={newMemberData.country}
              onChange={(e) => setNewMemberData({...newMemberData, country: e.target.value})}
              placeholder="Enter member's country"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={newMemberData.email}
              onChange={(e) => setNewMemberData({...newMemberData, email: e.target.value})}
              placeholder="Enter member's email"
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={newMemberData.phone}
              onChange={(e) => setNewMemberData({...newMemberData, phone: e.target.value})}
              placeholder="Enter member's phone"
            />
          </label>
          <label>
            Birthday
            <input
              type="text"
              value={newMemberData.birthday}
              onChange={(e) => setNewMemberData({...newMemberData, birthday: e.target.value})}
              placeholder="Enter birthday (MM-DD)"
            />
          </label>
          <label>
            Employee start date
            <input
              type="date"
              value={newMemberData.employee_start_date}
              onChange={(e) => setNewMemberData({...newMemberData, employee_start_date: e.target.value})}
              placeholder="Enter employee start date"
              required
            />
          </label>
          <label>
            Yearly vacation days
            <input
              type="number"
              step="0.01"
              value={newMemberData.yearly_vacation_days}
              onChange={(e) => setNewMemberData({...newMemberData, yearly_vacation_days: e.target.value})}
              placeholder="Enter yearly vacation days"
              required
            />
          </label>
          <div className="button-container">
            <button type="button" onClick={onClose} disabled={isPending}>Close</button>
            <button type="submit" disabled={isPending}>{editingMember ? 'Edit Member' : 'Add Member'}</button>
          </div>
        </form>
    </Modal>
  );
};

export default MemberModal;
