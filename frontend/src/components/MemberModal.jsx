import React, {useEffect, useRef, useState} from 'react';
import {useApi} from '../hooks/useApi';
import {toast} from "react-toastify";

const MemberModal = ({isOpen, onClose, selectedTeamId, updateTeamData, editingMember}) => {
  const [newMemberData, setNewMemberData] = useState({
    name: '',
    country: '',
    email: '',
    phone: '',
    birthday: '',
    employee_start_date: '',
    yearly_vacation_days: '',
    vac_days: []
  });
  const modalContentRef = useRef(null);
  const {apiCall} = useApi();

  useEffect(() => {
    if (editingMember) {
      setNewMemberData(editingMember);
    } else {
      setNewMemberData({
        name: '',
        country: '',
        email: '',
        phone: '',
        birthday: '',
        employee_start_date: '',
        yearly_vacation_days: '',
        vac_days: []
      });
    }
  }, [editingMember]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalContentRef.current && !modalContentRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleAddMemberFormSubmit = async (e) => {
    e.preventDefault();
    const method = editingMember ? 'PUT' : 'POST';
    const url = editingMember ? `/teams/${selectedTeamId}/members/${editingMember.uid}` : `/teams/${selectedTeamId}/members`;
    try {
      await apiCall(url, method, newMemberData);
      setNewMemberData({
        name: '',
        country: '',
        email: '',
        phone: '',
        birthday: '',
        employee_start_date: '',
        yearly_vacation_days: '',
        vac_days: []
      }); // Reset form data
      onClose(); // Close modal
      updateTeamData(); // Refresh team data
    } catch (error) {
      console.error('Error adding/modifying team member:', error);
      toast.error(error?.data?.detail[0].msg);
      if (error.data) {
        toast.error(error?.data?.detail.msg);
      } else if (error.data && error.data.msg) {
        toast.error(error?.data?.msg);
      } else {
        toast.error("An error occurred. Please try again.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content" ref={modalContentRef}>
        <form onSubmit={handleAddMemberFormSubmit}>
          <input
            type="text"
            value={newMemberData.name}
            onChange={(e) => setNewMemberData({...newMemberData, name: e.target.value})}
            placeholder="Enter member's name"
            required
          />
          <input
            type="text"
            value={newMemberData.country}
            onChange={(e) => setNewMemberData({...newMemberData, country: e.target.value})}
            placeholder="Enter member's country"
            required
          />
          <input
            type="email"
            value={newMemberData.email}
            onChange={(e) => setNewMemberData({...newMemberData, email: e.target.value})}
            placeholder="Enter member's email"
          />
          <input
            type="tel"
            value={newMemberData.phone}
            onChange={(e) => setNewMemberData({...newMemberData, phone: e.target.value})}
            placeholder="Enter member's phone"
          />
          <input
            type="text"
            value={newMemberData.birthday}
            onChange={(e) => setNewMemberData({...newMemberData, birthday: e.target.value})}
            placeholder="Enter birthday (MM-DD)"
          />
          <input
            type="date"
            value={newMemberData.employee_start_date}
            onChange={(e) => setNewMemberData({...newMemberData, employee_start_date: e.target.value})}
            placeholder="Enter employee start date"
            required
          />
          <input
            type="number"
            step="0.01"
            value={newMemberData.yearly_vacation_days}
            onChange={(e) => setNewMemberData({...newMemberData, yearly_vacation_days: e.target.value})}
            placeholder="Enter yearly vacation days"
            required
          />
          <div className="button-container">
            <button type="submit">{editingMember ? 'Edit Member' : 'Add Member'}</button>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MemberModal;
