import React, {useRef} from 'react';
import {useApi} from '../../hooks/useApi';
import {useAuth} from '../../contexts/AuthContext';
import {toast} from 'react-toastify';

const bufferToBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
const base64ToBuffer = (base64) => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

const SecurityKeyModal = ({isOpen, onClose}) => {
    const modalContentRef = useRef(null);
    const {apiCall} = useApi();
    const {user} = useAuth();

    const handleRegister = async () => {
        try {
            const opts = await apiCall('/webauthn/register-options', 'POST', {username: user.username});
            opts.challenge = base64ToBuffer(opts.challenge);
            opts.user.id = base64ToBuffer(opts.user.id);
            if (opts.excludeCredentials) {
                opts.excludeCredentials = opts.excludeCredentials.map(e => ({...e, id: base64ToBuffer(e.id)}));
            }
            const cred = await navigator.credentials.create({publicKey: opts});
            const credential = {
                id: bufferToBase64(cred.rawId),
                rawId: bufferToBase64(cred.rawId),
                type: cred.type,
                response: {
                    clientDataJSON: bufferToBase64(cred.response.clientDataJSON),
                    attestationObject: bufferToBase64(cred.response.attestationObject)
                }
            };
            await apiCall('/webauthn/register', 'POST', {username: user.username, credential});
            toast('Security key registered');
            onClose();
        } catch (e) {
            console.error(e);
            toast.error('Registration failed');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal">
            <div className="modal-content" ref={modalContentRef}>
                <p>Register a security key for passwordless login.</p>
                <div className="button-container">
                    <button onClick={handleRegister}>Register</button>
                    <button onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default SecurityKeyModal;
