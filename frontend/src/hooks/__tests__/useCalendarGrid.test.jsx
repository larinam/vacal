import {renderHook} from '@testing-library/react';
import useCalendarGrid from '../useCalendarGrid';

// The display month must be a STABLE reference across renders: the hook's effect
// depends on it, so a fresh `new Date()` per render would re-fire the effect and
// loop. In the real app it comes from useState, so it's stable — mirror that here.
const march2026 = new Date(2026, 2, 1);
const december2025 = new Date(2025, 11, 1);
const july2026 = new Date(2026, 6, 1);

test('builds the days header and week spans for the display month', () => {
  const {result} = renderHook(({month}) => useCalendarGrid(month), {
    initialProps: {month: march2026},
  });

  expect(result.current.daysHeader.length % 7).toBe(0);
  expect(result.current.daysHeader[0].date.getDay()).toBe(1); // Monday
  const totalSpan = Array.from(result.current.weekSpans.values()).reduce((a, b) => a + b, 0);
  expect(totalSpan).toBe(result.current.daysHeader.length);
});

test('December moves ISO week 1 to the end and spans two years', () => {
  const {result} = renderHook(({month}) => useCalendarGrid(month), {
    initialProps: {month: december2025},
  });

  expect(Array.from(result.current.weekSpans.keys())).toEqual([49, 50, 51, 52, 1]);
  expect(result.current.displayedYears).toEqual([2025, 2026]);
});

test('displayedYears reflects the built header', () => {
  const {result} = renderHook(({month}) => useCalendarGrid(month), {
    initialProps: {month: july2026},
  });
  expect(result.current.displayedYears).toContain(2026);
});
