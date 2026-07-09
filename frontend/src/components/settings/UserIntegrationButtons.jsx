import React from 'react';
import {faUnlink} from '@fortawesome/free-solid-svg-icons';
import {faGoogle, faTelegram} from '@fortawesome/free-brands-svg-icons';
import FontAwesomeIconWithTitle from '../FontAwesomeIconWithTitle';
import Modal from '../Modal';
import TelegramLogin from '../auth/TelegramLogin';
import useGoogleAuth from '../../hooks/useGoogleAuth';

export const GoogleConnectButton = ({onConnect, disabled}) => {
  const googleConnect = useGoogleAuth(onConnect);
  return (
    <FontAwesomeIconWithTitle
      icon={faGoogle}
      onClick={() => !disabled && googleConnect()}
      className="actionIcon"
      title="Connect Google account"
      aria-label="Connect Google account"
    />
  );
};

export const GoogleDisconnectButton = ({onDisconnect}) => (
  <FontAwesomeIconWithTitle
    icon={faUnlink}
    onClick={onDisconnect}
    className="actionIcon"
    title="Disconnect Google account"
    aria-label="Disconnect Google account"
  />
);

export const TelegramConnectButton = ({telegramBotUsername, isModalOpen, onOpenModal, onCloseModal, onAuth}) => (
  <>
    <FontAwesomeIconWithTitle
      icon={faTelegram}
      onClick={onOpenModal}
      className="actionIcon"
      title="Connect Telegram account"
      aria-label="Connect Telegram account"
    />
    <Modal isOpen={isModalOpen} onClose={onCloseModal}>
      <TelegramLogin
        telegramBotUsername={telegramBotUsername}
        onAuth={onAuth}
        title="Connect your Telegram account"
      />
    </Modal>
  </>
);

export const TelegramDisconnectButton = ({onDisconnect}) => (
  <FontAwesomeIconWithTitle
    icon={faUnlink}
    onClick={onDisconnect}
    className="actionIcon"
    title="Disconnect Telegram account"
    aria-label="Disconnect Telegram account"
  />
);
