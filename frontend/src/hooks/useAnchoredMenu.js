import {useCallback, useLayoutEffect, useRef, useState} from 'react';

// Position state for a context menu anchored at a pointer event, clamped to
// the right viewport edge once the menu's real width is known.
const useAnchoredMenu = () => {
  const ref = useRef(null);
  const [position, setPosition] = useState({x: 0, y: 0});
  const [isOpen, setIsOpen] = useState(false);

  const openAt = useCallback((event) => {
    setPosition({
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY,
    });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  useLayoutEffect(() => {
    if (isOpen && ref.current) {
      const menuWidth = ref.current.offsetWidth;
      let adjustedX = position.x;

      if (adjustedX + menuWidth > window.innerWidth) {
        adjustedX = Math.max(0, adjustedX - menuWidth);
      }

      if (adjustedX !== position.x) {
        setPosition({x: adjustedX, y: position.y});
      }
    }
  }, [isOpen, position]);

  return {ref, position, isOpen, openAt, close};
};

export default useAnchoredMenu;
