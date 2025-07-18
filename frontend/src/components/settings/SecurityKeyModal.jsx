import React, {useRef} from 'react';
import {useApi} from '../../hooks/useApi';
import {useAuth} from '../../contexts/AuthContext';
import {toast} from 'react-toastify';

const bufferToBase64Url = (buffer) => {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64UrlToBuffer = (base64url) => {
    const base64 = base64url
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
};

const SecurityKeyModal = ({isOpen, onClose}) => {
    const modalContentRef = useRef(null);
    const {apiCall} = useApi();
    const {user} = useAuth();

    const handleRegister = async () => {
        try {
            const opts = await apiCall('/webauthn/register-options', 'POST', {username: user.username});
            opts.challenge = base64UrlToBuffer(opts.challenge);
            opts.user.id = base64UrlToBuffer(opts.user.id);
            if (opts.excludeCredentials) {
                opts.excludeCredentials = opts.excludeCredentials.map(e => ({...e, id: base64UrlToBuffer(e.id)}));
            }
            const cred = await navigator.credentials.create({publicKey: opts});
            const credential = {
                id: bufferToBase64Url(cred.rawId),
                rawId: bufferToBase64Url(cred.rawId),
                type: cred.type,
                response: {
                    clientDataJSON: bufferToBase64Url(cred.response.clientDataJSON),
                    attestationObject: bufferToBase64Url(cred.response.attestationObject)
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
