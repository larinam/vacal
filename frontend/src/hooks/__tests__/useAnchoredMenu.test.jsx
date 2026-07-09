import {act, renderHook} from '@testing-library/react';
import useAnchoredMenu from '../useAnchoredMenu';

const attachMenuElement = (ref, width) => {
  const element = document.createElement('div');
  Object.defineProperty(element, 'offsetWidth', {value: width});
  document.body.appendChild(element);
  ref.current = element;
  return element;
};

test('openAt stores the pointer position and opens the menu', () => {
  const {result} = renderHook(() => useAnchoredMenu());
  expect(result.current.isOpen).toBe(false);

  act(() => {
    result.current.openAt({clientX: 100, clientY: 200});
  });

  expect(result.current.isOpen).toBe(true);
  expect(result.current.position).toEqual({x: 100 + window.scrollX, y: 200 + window.scrollY});
});

test('clamps the x position when the menu would overflow the right edge', () => {
  const {result} = renderHook(() => useAnchoredMenu());
  attachMenuElement(result.current.ref, 300);

  const nearRightEdge = window.innerWidth - 10;
  act(() => {
    result.current.openAt({clientX: nearRightEdge, clientY: 50});
  });

  expect(result.current.position.x).toBe(Math.max(0, nearRightEdge - 300));
  expect(result.current.position.y).toBe(50);
});

test('leaves a fitting position untouched', () => {
  const {result} = renderHook(() => useAnchoredMenu());
  attachMenuElement(result.current.ref, 50);

  act(() => {
    result.current.openAt({clientX: 10, clientY: 20});
  });

  expect(result.current.position).toEqual({x: 10, y: 20});
});

test('close flips isOpen off', () => {
  const {result} = renderHook(() => useAnchoredMenu());
  act(() => result.current.openAt({clientX: 1, clientY: 1}));
  act(() => result.current.close());
  expect(result.current.isOpen).toBe(false);
});
