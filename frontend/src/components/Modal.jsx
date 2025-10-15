import React, { useRef } from 'react';
import './Modal.css';
import useDismiss from '../hooks/useDismiss';

const Modal = ({ isOpen, onClose, children }) => {
  const modalContentRef = useRef(null);

  useDismiss(modalContentRef, onClose, { enabled: isOpen, includeEscape: true });

  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content" ref={modalContentRef}>
        {children}
      </div>
    </div>
  );
};

export default Modal;
