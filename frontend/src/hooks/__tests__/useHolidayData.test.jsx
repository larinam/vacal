import React from 'react';
import {renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import useHolidayData from '../useHolidayData';

const {apiCallMock} = vi.hoisted(() => ({
  apiCallMock: vi.fn(),
}));

vi.mock('../useApi', () => ({
  useApi: () => ({apiCall: apiCallMock}),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  });
  return ({children}) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

test('fetches holidays for each displayed year and merges them', async () => {
  apiCallMock.mockImplementation((url) => {
    const year = new URL(url, 'http://x').searchParams.get('year');
    return Promise.resolve({holidays: {Sweden: {[`${year}-06-19`]: `Midsummer ${year}`}}});
  });

  const {result} = renderHook(
    () => useHolidayData({holidays: undefined, teamCountries: ['Sweden'], displayedYears: [2025, 2026]}),
    {wrapper: createWrapper()}
  );

  await waitFor(() => {
    expect(result.current.holidayData?.Sweden?.['2025-06-19']).toBe('Midsummer 2025');
    expect(result.current.holidayData?.Sweden?.['2026-06-19']).toBe('Midsummer 2026');
  });
  expect(apiCallMock).toHaveBeenCalledWith('/teams/holidays?year=2025', 'GET', null, false, expect.anything());
  expect(apiCallMock).toHaveBeenCalledWith('/teams/holidays?year=2026', 'GET', null, false, expect.anything());
});

test('does not fetch when every displayed year is already covered for all countries', () => {
  const holidays = {Sweden: {'2026-01-01': "New Year's Day"}};

  renderHook(
    () => useHolidayData({holidays, teamCountries: ['Sweden'], displayedYears: [2026]}),
    {wrapper: createWrapper()}
  );

  expect(apiCallMock).not.toHaveBeenCalled();
});

test('fetches a covered year again when a new country appears without data', async () => {
  apiCallMock.mockResolvedValue({holidays: {Norway: {'2026-05-17': 'Constitution Day'}}});
  const holidays = {Sweden: {'2026-01-01': "New Year's Day"}};

  const {result} = renderHook(
    () => useHolidayData({holidays, teamCountries: ['Sweden', 'Norway'], displayedYears: [2026]}),
    {wrapper: createWrapper()}
  );

  await waitFor(() => {
    expect(result.current.holidayData?.Norway?.['2026-05-17']).toBe('Constitution Day');
  });
  // Existing data is preserved alongside the merged response.
  expect(result.current.holidayData?.Sweden?.['2026-01-01']).toBe("New Year's Day");
});
