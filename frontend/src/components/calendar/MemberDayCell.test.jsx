import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import MemberDayCell from './MemberDayCell';

const HOLIDAYS = {Sweden: {'2026-06-19': 'Midsummer Eve'}};
const VACATION = {_id: 'vac', name: 'Vacation', color: 'green'};

const member = (days = {}) => ({uid: 'm1', name: 'Alice', country: 'Sweden', days});

const renderCell = (props = {}) => {
  const handlers = {
    onMouseDown: vi.fn(),
    onMouseOver: vi.fn(),
    onMouseUp: vi.fn(),
    onClick: vi.fn(),
  };
  render(
    <table>
      <tbody>
      <tr>
        <MemberDayCell
          teamId="t1"
          member={member()}
          date={new Date(2026, 6, 9)}
          holidayData={{}}
          isSelected={false}
          {...handlers}
          {...props}
        />
      </tr>
      </tbody>
    </table>
  );
  return handlers;
};

const getCell = () => screen.getByRole('cell');

test('holiday date gets the holiday class and the holiday name as title', () => {
  renderCell({date: new Date(2026, 5, 19), holidayData: HOLIDAYS});
  expect(getCell()).toHaveClass('holiday-cell');
  expect(getCell()).toHaveAttribute('title', 'Midsummer Eve');
});

test('weekend date gets the weekend class and title', () => {
  renderCell({date: new Date(2026, 6, 11)}); // Saturday
  expect(getCell()).toHaveClass('weekend-cell');
  expect(getCell()).toHaveAttribute('title', 'Weekend');
});

test('day types render the day-type title and comment marker', () => {
  // The gradient string itself is covered by generateGradientStyle's unit test;
  // jsdom's CSSOM drops `background: linear-gradient(...)` so it cannot be read
  // back off the DOM node here (verified in the browser E2E instead).
  renderCell({member: member({'2026-07-09': {day_types: [VACATION], comment: 'trip'}})});
  expect(getCell()).toHaveAttribute('title', 'Vacation: trip');
  expect(screen.getByText('*')).toBeInTheDocument();
});

test('selected cell gets the selected-range class', () => {
  renderCell({isSelected: true});
  expect(getCell()).toHaveClass('selected-range');
});

test('mouse-down reports selectability; click passes the holiday value through', () => {
  const date = new Date(2026, 5, 19);
  const handlers = renderCell({date, holidayData: HOLIDAYS});

  fireEvent.mouseDown(getCell());
  expect(handlers.onMouseDown).toHaveBeenCalledWith('t1', 'm1', date, false); // holiday is not selectable

  fireEvent.click(getCell());
  expect(handlers.onClick).toHaveBeenCalledWith('t1', 'm1', date, 'Midsummer Eve', expect.anything());

  fireEvent.mouseUp(getCell());
  expect(handlers.onMouseUp).toHaveBeenCalled();
});

test('plain weekday is selectable on mouse-down', () => {
  const date = new Date(2026, 6, 9);
  const handlers = renderCell({date});
  fireEvent.mouseDown(getCell());
  expect(handlers.onMouseDown).toHaveBeenCalledWith('t1', 'm1', date, true);
});
