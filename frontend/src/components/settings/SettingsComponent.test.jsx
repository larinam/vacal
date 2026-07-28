import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import SettingsComponent from './SettingsComponent';

const {configMock} = vi.hoisted(() => ({
  configMock: {isMultitenancyEnabled: false},
}));

vi.mock('../../contexts/ConfigContext', () => ({
  useConfig: () => configMock,
}));

vi.mock('./UserManagement', () => ({
  default: () => <div>users-panel</div>,
}));

vi.mock('./DayTypes', () => ({
  default: () => <div>day-types-panel</div>,
}));

vi.mock('./SubscriptionManagement', () => ({
  default: () => <div>subscription-panel</div>,
}));

const renderSettings = (initialPath = '/main/settings') => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route path="/main/settings/*" element={<SettingsComponent onClose={() => {}}/>}/>
    </Routes>
  </MemoryRouter>
);

const navLabels = () => Array.from(document.querySelectorAll('.navItem')).map(item => item.textContent);

describe('SettingsComponent', () => {
  beforeEach(() => {
    configMock.isMultitenancyEnabled = false;
  });

  it('opens on Users', () => {
    renderSettings();
    expect(screen.getByText('users-panel')).toBeInTheDocument();
  });

  it('lists Users first', () => {
    renderSettings();
    expect(navLabels()).toEqual(['Users', 'Day Types']);
  });

  it('marks Users as the active tab when opened without a sub-path', () => {
    renderSettings();
    expect(screen.getByRole('link', {name: 'Users'})).toHaveClass('active');
  });

  it('still opens the other tabs directly', () => {
    renderSettings('/main/settings/daytypes');
    expect(screen.getByText('day-types-panel')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Day Types'})).toHaveClass('active');
  });

  it('falls back to Users for an unknown sub-path', () => {
    renderSettings('/main/settings/nonsense');
    expect(screen.getByText('users-panel')).toBeInTheDocument();
  });

  it('keeps Subscription last when multitenancy is enabled', () => {
    configMock.isMultitenancyEnabled = true;
    renderSettings();
    expect(navLabels()).toEqual(['Users', 'Day Types', 'Subscription']);
  });
});
