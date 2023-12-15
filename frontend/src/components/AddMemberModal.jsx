import React, { useEffect, useRef } from 'react';

const AddMemberModal = ({ isOpen, onClose, onSubmit, memberData, setMemberData }) => {
    const modalContentRef = useRef(null);

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

    if (!isOpen) return null;

    return (
        <div className="modal">
            <div className="modal-content" ref={modalContentRef}>
                <form onSubmit={onSubmit}>
                    <input
                        type="text"
                        value={memberData.name}
                        onChange={(e) => setMemberData({ ...memberData, name: e.target.value })}
                        placeholder="Enter member's name"
                        required
                    />
                    <input
                        type="text"
                        value={memberData.country}
                        onChange={(e) => setMemberData({ ...memberData, country: e.target.value })}
                        placeholder="Enter member's country"
                        required
                    />
                    {/* Add input fields for vacation days if needed */}
                    <div className="button-container">
                        <button type="submit">Add Member</button>
                        <button type="button" onClick={onClose}>Close</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddMemberModal;