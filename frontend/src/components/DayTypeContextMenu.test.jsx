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
  toast: {error: vi.fn(), success: vi.fn()},
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
