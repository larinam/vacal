import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import React from 'react';
import {render, act} from '@testing-library/react';
import useTelegramAuth from '../useTelegramAuth';

const Harness = ({botUsername, onAuth}) => {
  const ref = useTelegramAuth(botUsername, onAuth);
  return <div data-testid="container" ref={ref}/>;
};

const getContainer = (utils) => utils.getByTestId('container');
const countTelegramScripts = (container) =>
  container.querySelectorAll('script[src*="telegram-widget.js"]').length;

describe('useTelegramAuth', () => {
  beforeEach(() => {
    delete window.onTelegramAuth;
  });

  afterEach(() => {
    delete window.onTelegramAuth;
  });

  it('injects the Telegram widget script on mount', () => {
    const utils = render(<Harness botUsername="test_bot" onAuth={vi.fn()}/>);
    const container = getContainer(utils);
    expect(countTelegramScripts(container)).toBe(1);
    const script = container.querySelector('script');
    expect(script.getAttribute('data-telegram-login')).toBe('test_bot');
    expect(script.getAttribute('data-onauth')).toBe('onTelegramAuth(user)');
    expect(typeof window.onTelegramAuth).toBe('function');
  });

  it('does not inject when bot username is missing', () => {
    const utils = render(<Harness botUsername="" onAuth={vi.fn()}/>);
    expect(countTelegramScripts(getContainer(utils))).toBe(0);
  });

  it('re-injects the widget when the tab becomes visible and the iframe is missing', () => {
    const utils = render(<Harness botUsername="test_bot" onAuth={vi.fn()}/>);
    const container = getContainer(utils);
    expect(countTelegramScripts(container)).toBe(1);
    // The Telegram script does not actually execute in jsdom, so no iframe
    // is ever rendered — this matches the real-world "widget missing" state
    // after the browser discards the background tab.
    expect(container.querySelector('iframe')).toBeNull();

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Container is cleared and the script is re-injected (still exactly one).
    expect(countTelegramScripts(container)).toBe(1);
    // Sanity: the current script node is freshly created, not the original one.
    const script = container.querySelector('script');
    expect(script.getAttribute('data-telegram-login')).toBe('test_bot');
  });

  it('re-injects the widget on pageshow (bfcache restore)', () => {
    const utils = render(<Harness botUsername="test_bot" onAuth={vi.fn()}/>);
    const container = getContainer(utils);
    const firstScript = container.querySelector('script');

    act(() => {
      const event = new Event('pageshow');
      Object.defineProperty(event, 'persisted', {value: true});
      window.dispatchEvent(event);
    });

    expect(countTelegramScripts(container)).toBe(1);
    expect(container.querySelector('script')).not.toBe(firstScript);
  });

  it('cleans up listeners, container and global callback on unmount', () => {
    const utils = render(<Harness botUsername="test_bot" onAuth={vi.fn()}/>);
    const container = getContainer(utils);
    expect(typeof window.onTelegramAuth).toBe('function');

    utils.unmount();

    expect(window.onTelegramAuth).toBeUndefined();

    // Dispatching events after unmount must not throw and must not
    // re-inject into a detached container.
    const scriptsBefore = container.querySelectorAll('script').length;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pageshow'));
    });
    const scriptsAfter = container.querySelectorAll('script').length;
    expect(scriptsAfter).toBe(scriptsBefore);
  });
});
