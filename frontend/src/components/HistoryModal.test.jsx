import React from 'react';
import {render, screen} from '@testing-library/react';
import HistoryModal, {DayHistoryModal, MemberHistoryModal, TeamHistoryModal} from './HistoryModal';

const {usePaginatedHistoryMock, historyListPropsMock} = vi.hoisted(() => ({
  usePaginatedHistoryMock: vi.fn(),
  historyListPropsMock: vi.fn(),
}));

vi.mock('../hooks/usePaginatedHistory', () => ({
  usePaginatedHistory: usePaginatedHistoryMock,
}));

vi.mock('./HistoryList', () => ({
  default: (props) => {
    historyListPropsMock(props);
    return <div data-testid="history-list" />;
  },
}));

const historyResult = (history = []) => ({
  history,
  listRef: {current: null},
  handleScroll: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  usePaginatedHistoryMock.mockReturnValue(historyResult());
});

test('renders nothing when closed and passes isOpen=false to usePaginatedHistory', () => {
  const {container} = render(
    <HistoryModal isOpen={false} onClose={vi.fn()} endpoint="/x" title="X" />
  );
  expect(container).toBeEmptyDOMElement();
  expect(usePaginatedHistoryMock).toHaveBeenCalledWith(false, '/x');
});

test('pluralizes the item count in the heading', () => {
  usePaginatedHistoryMock.mockReturnValue(historyResult([{_id: '1'}]));
  const {rerender} = render(
    <HistoryModal isOpen onClose={vi.fn()} endpoint="/x" title="X" />
  );
  expect(screen.getByRole('heading')).toHaveTextContent('History for X (1 item)');

  usePaginatedHistoryMock.mockReturnValue(historyResult([{_id: '1'}, {_id: '2'}]));
  rerender(<HistoryModal isOpen onClose={vi.fn()} endpoint="/x" title="X" />);
  expect(screen.getByRole('heading')).toHaveTextContent('History for X (2 items)');
});

test('forwards showDate and memberLookup to HistoryList', () => {
  const memberLookup = vi.fn();
  render(
    <HistoryModal isOpen onClose={vi.fn()} endpoint="/x" title="X" showDate memberLookup={memberLookup} />
  );
  expect(historyListPropsMock).toHaveBeenCalledWith(
    expect.objectContaining({showDate: true, memberLookup})
  );
});

test('DayHistoryModal builds the day endpoint and uses the date as title', () => {
  render(
    <DayHistoryModal isOpen onClose={vi.fn()} teamId="t1" memberId="m1" date="2026-07-09" />
  );
  expect(usePaginatedHistoryMock).toHaveBeenCalledWith(true, '/teams/t1/members/m1/days/2026-07-09/history');
  expect(screen.getByRole('heading')).toHaveTextContent('History for 2026-07-09');
  expect(historyListPropsMock).toHaveBeenCalledWith(expect.objectContaining({showDate: false}));
});

test('MemberHistoryModal builds the member endpoint with showDate', () => {
  render(
    <MemberHistoryModal isOpen onClose={vi.fn()} teamId="t1" memberId="m1" memberName="Alice" />
  );
  expect(usePaginatedHistoryMock).toHaveBeenCalledWith(true, '/teams/t1/members/m1/history');
  expect(screen.getByRole('heading')).toHaveTextContent('History for Alice');
  expect(historyListPropsMock).toHaveBeenCalledWith(expect.objectContaining({showDate: true}));
});

test('TeamHistoryModal builds a member lookup and guards a missing teamId', () => {
  render(
    <TeamHistoryModal
      isOpen
      onClose={vi.fn()}
      teamId="t1"
      teamName="Alpha"
      teamMembers={[{uid: 'u1', name: 'Alice'}]}
    />
  );
  expect(usePaginatedHistoryMock).toHaveBeenCalledWith(true, '/teams/t1/history');
  const {memberLookup} = historyListPropsMock.mock.calls.at(-1)[0];
  expect(memberLookup('u1')).toBe('Alice');
  expect(memberLookup('unknown')).toBeUndefined();

  usePaginatedHistoryMock.mockClear();
  render(<TeamHistoryModal isOpen onClose={vi.fn()} teamName="Alpha" />);
  expect(usePaginatedHistoryMock).toHaveBeenCalledWith(true, null);
});
