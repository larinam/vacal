import React, {createRef} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import DayTypeContextMenu from './DayTypeContextMenu';

const {apiCallMock, mutateAsyncMock} = vi.hoisted(() => ({
  apiCallMock: vi.fn(),
  mutateAsyncMock: vi.fn(),
}));

vi.mock('../hooks/useApi', () => ({
  useApi: () => ({apiCall: apiCallMock}),
}));

vi.mock('../hooks/mutations/useDayAssignmentsMutation', () => ({
  default: () => ({mutateAsync: mutateAsyncMock}),
}));

vi.mock('react-toastify', () => ({
  toast: {error: vi.fn(), success: vi.fn(), warn: vi.fn()},
}));

const renderMenu = (overrides = {}) => {
  const onClose = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  });
  const props = {
    contextMenuRef: createRef(),
    isOpen: true,
    position: {x: 0, y: 0},
    onClose,
    dayTypes: [],
    selectedDayInfo: {
      teamId: 't1',
      memberId: 'm1',
      memberName: 'Alice',
      dateRange: [new Date(2026, 6, 9)],
      existingDayTypes: [],
      existingComment: '',
    },
    updateTeamData: vi.fn(),
    updateLocalTeamData: vi.fn(),
    teamData: [{_id: 't1', team_members: [{uid: 'm1', name: 'Alice', days: {}}]}],
    ...overrides,
  };
  render(
    <QueryClientProvider client={queryClient}>
      <div className="calendar-table">
        <span data-testid="calendar-cell">cell</span>
      </div>
      <div className="modal">
        <span data-testid="modal-content">modal</span>
      </div>
      <DayTypeContextMenu {...props} />
    </QueryClientProvider>
  );
  return {onClose};
};

beforeEach(() => {
  vi.clearAllMocks();
  apiCallMock.mockResolvedValue({});
});

test('pointerdown outside the menu closes it', () => {
  const {onClose} = renderMenu();
  fireEvent.pointerDown(document.body);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('pointerdown inside the calendar table does not close the menu', () => {
  const {onClose} = renderMenu();
  fireEvent.pointerDown(screen.getByTestId('calendar-cell'));
  expect(onClose).not.toHaveBeenCalled();
});

test('pointerdown inside a modal does not close the menu', () => {
  const {onClose} = renderMenu();
  fireEvent.pointerDown(screen.getByTestId('modal-content'));
  expect(onClose).not.toHaveBeenCalled();
});

test('pointerdown inside the menu itself does not close it', () => {
  const {onClose} = renderMenu();
  fireEvent.pointerDown(screen.getByText('Alice'));
  expect(onClose).not.toHaveBeenCalled();
});

test('Escape closes the menu without saving an unchanged comment', () => {
  const {onClose} = renderMenu();
  fireEvent.keyDown(document, {key: 'Escape'});
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(mutateAsyncMock).not.toHaveBeenCalled();
});

test('no dismiss listeners are active while closed', () => {
  const {onClose} = renderMenu({isOpen: false});
  fireEvent.pointerDown(document.body);
  fireEvent.keyDown(document, {key: 'Escape'});
  expect(onClose).not.toHaveBeenCalled();
});

// The vacation-balance confirm had no coverage at all, and the "next year isn't budgeted
// yet" bypass silently swallowed overdraws once the balance started spanning years.
describe('vacation balance guard', () => {
  const VACATION = {_id: 'vac', identifier: 'vacation', name: 'Vacation', color: 'green'};

  const marchDates = (year) => [2, 3, 4, 5, 6].map((day) => new Date(year, 2, day));

  const renderWithBalance = ({availableDays, lastWorkingDay, dateRange}) => renderMenu({
    dayTypes: [VACATION],
    selectedDayInfo: {
      teamId: 't1',
      memberId: 'm1',
      memberName: 'Alice',
      dateRange,
      existingDayTypes: [],
      existingComment: '',
    },
    teamData: [{
      _id: 't1',
      team_members: [{
        uid: 'm1',
        name: 'Alice',
        days: {},
        vacation_available_days: availableDays,
        last_working_day: lastWorkingDay,
      }],
    }],
  });

  const checkVacation = () => fireEvent.click(screen.getByLabelText('Vacation'));

  test('declining the overdraw confirm aborts the update', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithBalance({availableDays: 2, lastWorkingDay: null, dateRange: marchDates(2026)});

    checkVacation();

    expect(confirmSpy).toHaveBeenCalledWith(
      'Not enough vacation days available. Do you want to continue?');
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('an overdraw inside a leaver departure year is caught, not bypassed', () => {
    // Five days in 2027 against a balance of 2, for somebody leaving 2027-03-31. The
    // balance covers that year, so the all-future-years bypass must not apply.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithBalance({
      availableDays: 2,
      lastWorkingDay: '2027-03-31',
      dateRange: marchDates(2027),
    });

    checkVacation();

    expect(confirmSpy).toHaveBeenCalled();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('a member with no departure keeps the next-year bypass', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithBalance({
      availableDays: 2,
      lastWorkingDay: null,
      dateRange: marchDates(new Date().getFullYear() + 1),
    });

    checkVacation();

    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('days past the last working day are flagged as uncharged', async () => {
    const {toast} = await import('react-toastify');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithBalance({
      availableDays: 50,
      lastWorkingDay: '2027-03-03',
      dateRange: marchDates(2027),
    });

    checkVacation();

    // 2027-03-04 through 2027-03-06 fall past the last working day.
    expect(toast.warn).toHaveBeenCalledWith(expect.stringContaining('3 of the selected days'));
    expect(toast.warn).toHaveBeenCalledWith(expect.stringContaining('2027-03-03'));
    confirmSpy.mockRestore();
  });
});
