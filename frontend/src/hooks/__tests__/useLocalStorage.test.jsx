import {act, render, screen} from '@testing-library/react';
import {useLocalStorage} from '../useLocalStorage';

const Harness = ({storageKey, defaultValue, render: renderValue}) => {
  const [value, setValue] = useLocalStorage(storageKey, defaultValue);
  return (
    <div>
      <span data-testid="value">{renderValue ? renderValue(value) : String(value)}</span>
      <button onClick={() => setValue('set-from-tab')}>set</button>
    </div>
  );
};

const dispatchStorage = (key, newValue) => act(() => {
  window.dispatchEvent(new StorageEvent('storage', {key, newValue}));
});

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads the stored value and falls back to the default', () => {
    localStorage.setItem('greeting', 'stored');
    render(<Harness storageKey="greeting" defaultValue="fallback"/>);
    expect(screen.getByTestId('value')).toHaveTextContent('stored');

    render(<Harness storageKey="missing" defaultValue="fallback"/>);
    expect(screen.getAllByTestId('value')[1]).toHaveTextContent('fallback');
  });

  it('picks up a value written by another tab', () => {
    // The refresh token rotates on every renewal: a tab that keeps the previous
    // value would fail its next refresh and log everybody out.
    localStorage.setItem('refreshToken', 'first-token');
    render(<Harness storageKey="refreshToken" defaultValue=""/>);
    expect(screen.getByTestId('value')).toHaveTextContent('first-token');

    dispatchStorage('refreshToken', 'rotated-token');
    expect(screen.getByTestId('value')).toHaveTextContent('rotated-token');
  });

  it('falls back to the default when another tab removes the key', () => {
    localStorage.setItem('authHeader', 'Bearer abc');
    render(<Harness storageKey="authHeader" defaultValue="empty"/>);

    dispatchStorage('authHeader', null);
    expect(screen.getByTestId('value')).toHaveTextContent('empty');
  });

  it('ignores events for other keys', () => {
    localStorage.setItem('kept', 'mine');
    render(<Harness storageKey="kept" defaultValue=""/>);

    dispatchStorage('somethingElse', 'theirs');
    expect(screen.getByTestId('value')).toHaveTextContent('mine');
  });

  it('does not re-apply an object value echoed back by the other tab', () => {
    const user = {name: 'Alice'};
    localStorage.setItem('user', JSON.stringify(user));
    const renderValue = vi.fn((value) => value?.name ?? 'none');
    render(<Harness storageKey="user" defaultValue={null} render={renderValue}/>);
    const rendersBefore = renderValue.mock.calls.length;

    // The other tab writing the identical JSON must not start a render ping-pong.
    dispatchStorage('user', JSON.stringify(user));
    expect(renderValue.mock.calls.length).toBe(rendersBefore);
    expect(screen.getByTestId('value')).toHaveTextContent('Alice');
  });

  it('still persists local updates', () => {
    render(<Harness storageKey="greeting" defaultValue="fallback"/>);
    act(() => screen.getByText('set').click());
    expect(localStorage.getItem('greeting')).toBe('set-from-tab');
  });
});
