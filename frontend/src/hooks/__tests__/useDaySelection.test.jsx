import {act, renderHook} from '@testing-library/react';
import useDaySelection from '../useDaySelection';

const VACATION = {_id: 'vac', name: 'Vacation'};

const buildTeamData = (days = {}) => ([
  {
    _id: 't1',
    team_members: [{uid: 'm1', name: 'Alice', country: 'Sweden', days}],
  },
]);

const member = (teamData) => teamData[0].team_members[0];

const setup = (teamData, holidayData = {}) => {
  const onSelectionComplete = vi.fn();
  const hook = renderHook(() => useDaySelection({teamData, holidayData, onSelectionComplete}));
  return {...hook, onSelectionComplete};
};

test('drag across a week selects only selectable days (weekend excluded)', () => {
  const teamData = buildTeamData();
  const {result} = setup(teamData);

  // Thursday 2026-07-09 → Monday 2026-07-13
  act(() => result.current.handleMouseDown('t1', 'm1', new Date(2026, 6, 9), true));
  act(() => result.current.handleMouseOver('t1', 'm1', new Date(2026, 6, 13), member(teamData)));

  const selectedDays = result.current.selectedCells.map((c) => c.date.getDate());
  expect(selectedDays).toEqual([9, 10, 13]); // Sat 11 and Sun 12 skipped
});

test('mouse-down on a non-selectable, typeless day starts no selection', () => {
  const {result} = setup(buildTeamData());

  act(() => result.current.handleMouseDown('t1', 'm1', new Date(2026, 6, 11), false)); // Saturday

  expect(result.current.selectedCells).toEqual([]);
});

test('mouse-up reports the selection with the day types captured at mouse-down', () => {
  const teamData = buildTeamData({'2026-07-09': {day_types: [VACATION]}});
  const {result, onSelectionComplete} = setup(teamData);

  act(() => result.current.handleMouseDown('t1', 'm1', new Date(2026, 6, 9), false));
  const event = {type: 'mouseup'};
  act(() => result.current.handleMouseUp(event));

  expect(onSelectionComplete).toHaveBeenCalledWith({
    teamId: 't1',
    memberId: 'm1',
    dates: [new Date(2026, 6, 9)],
    event,
    selectionDayTypes: ['vac'],
  });
  // The highlight stays until the caller clears it (menu close).
  expect(result.current.selectedCells).toHaveLength(1);
});

test('mouse-up with no selection reports nothing', () => {
  const {result, onSelectionComplete} = setup(buildTeamData());
  act(() => result.current.handleMouseUp({type: 'mouseup'}));
  expect(onSelectionComplete).not.toHaveBeenCalled();
});

test('mouse-over on a different member does not extend the selection', () => {
  const teamData = buildTeamData();
  const {result} = setup(teamData);

  act(() => result.current.handleMouseDown('t1', 'm1', new Date(2026, 6, 9), true));
  act(() => result.current.handleMouseOver('t1', 'other', new Date(2026, 6, 10), {uid: 'other', days: {}}));

  expect(result.current.selectedCells).toHaveLength(1);
});

test('clearSelection empties the selection', () => {
  const teamData = buildTeamData();
  const {result} = setup(teamData);

  act(() => result.current.handleMouseDown('t1', 'm1', new Date(2026, 6, 9), true));
  act(() => result.current.clearSelection());

  expect(result.current.selectedCells).toEqual([]);
});
