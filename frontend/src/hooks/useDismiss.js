import {useEffect} from 'react';

const DEFAULT_EVENTS = ['mousedown'];

const normalizeTargets = (targets) => {
  if (!targets) {
    return [];
  }

  const candidateTargets = Array.isArray(targets) ? targets : [targets];
  return candidateTargets
    .map((target) => {
      if (!target) {
        return null;
      }
      if (typeof target === 'object' && 'current' in target) {
        return target.current;
      }
      return target;
    })
    .filter(Boolean);
};

/**
 * Invokes dismissal handlers when interactions happen outside the provided target(s) or via Escape key.
 */
export const useDismiss = (targets, handler, options = {}) => {
  const {
    enabled = true,
    eventTypes,
    includeEscape = false,
    onEscape,
    escapeKey = 'Escape',
  } = options;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const dismissHandler = typeof handler === 'function' ? handler : null;
    const escapeHandler =
      typeof onEscape === 'function'
        ? onEscape
        : includeEscape
          ? dismissHandler
          : null;

    if (!dismissHandler && !escapeHandler) {
      return undefined;
    }

    const resolvedTargets = normalizeTargets(targets);
    const events = eventTypes && eventTypes.length ? eventTypes : DEFAULT_EVENTS;
    const listeners = [];

    if (dismissHandler && resolvedTargets.length > 0 && events.length > 0) {
      const outsideListener = (event) => {
        const isInside = resolvedTargets.some((target) => target?.contains?.(event.target));

        if (!isInside) {
          dismissHandler(event);
        }
      };

      events.forEach((eventName) => {
        document.addEventListener(eventName, outsideListener);
        listeners.push({eventName, listener: outsideListener});
      });
    }

    if (escapeHandler) {
      const escapeListener = (event) => {
        if (event.key === escapeKey) {
          escapeHandler(event);
        }
      };

      document.addEventListener('keydown', escapeListener);
      listeners.push({eventName: 'keydown', listener: escapeListener});
    }

    return () => {
      listeners.forEach(({eventName, listener}) => {
        document.removeEventListener(eventName, listener);
      });
    };
  }, [
    targets,
    handler,
    enabled,
    eventTypes,
    includeEscape,
    onEscape,
    escapeKey,
  ]);
};

export default useDismiss;
