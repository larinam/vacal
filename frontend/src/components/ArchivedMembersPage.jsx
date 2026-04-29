import {useMemo, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useArchivedMembersQuery} from '../hooks/queries/useArchivedMembersQuery';
import './ArchivedMembersPage.css';

const SEPARATION_LABELS = {
    resignation:      'Resignation (voluntary)',
    termination:      'Termination by employer',
    redundancy:       'Redundancy / position eliminated',
    mutual_agreement: 'Mutual agreement',
    end_of_contract:  'End of fixed-term contract',
    retirement:       'Retirement',
};

const BADGE_CLASS = {
    resignation:      'neutral',
    termination:      'amber',
    redundancy:       'amber',
    mutual_agreement: 'teal',
    end_of_contract:  'neutral',
    retirement:       'neutral',
};

function formatTenure(startDate, endDate) {
    if (!startDate) return '—';
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years === 0) return `${rem}m`;
    if (rem === 0) return `${years}y`;
    return `${years}y ${rem}m`;
}

function formatDate(iso) {
    if (!iso) return '—';
    return iso;
}

function SeparationBadge({value}) {
    if (!value) return <span className="archivedMembersPage__badge archivedMembersPage__badge--neutral">—</span>;
    const cls = BADGE_CLASS[value] ?? 'neutral';
    return (
        <span className={`archivedMembersPage__badge archivedMembersPage__badge--${cls}`}>
            {SEPARATION_LABELS[value] ?? value}
        </span>
    );
}

const COLUMNS = [
    {key: 'name',               label: 'Name'},
    {key: 'team_name',          label: 'Team'},
    {key: 'country',            label: 'Country'},
    {key: 'employee_start_date',label: 'Start date'},
    {key: 'last_working_day',   label: 'Last working day'},
    {key: 'tenure',             label: 'Tenure'},
    {key: 'separation_type',    label: 'Separation type'},
    {key: 'deleted_by',         label: 'Archived by'},
    {key: 'deleted_at',         label: 'Archived date'},
];

const ArchivedMembersPage = ({user, apiCall}) => {
    if (user?.role !== 'manager') return <Navigate to="/main" replace />;

    const {data, isLoading, error} = useArchivedMembersQuery(apiCall);
    const members = data?.archived_members ?? [];

    const teams = useMemo(() => [...new Set(members.map(m => m.team_name))].sort(), [members]);

    const [filterTeam, setFilterTeam] = useState('');
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');
    const [filterSeparation, setFilterSeparation] = useState('');
    const [sortKey, setSortKey] = useState('deleted_at');
    const [sortAsc, setSortAsc] = useState(false);

    const filtered = useMemo(() => members.filter(m => {
        if (filterTeam && m.team_name !== filterTeam) return false;
        if (filterFrom && m.last_working_day && m.last_working_day < filterFrom) return false;
        if (filterTo && m.last_working_day && m.last_working_day > filterTo) return false;
        if (filterSeparation && m.separation_type !== filterSeparation) return false;
        return true;
    }), [members, filterTeam, filterFrom, filterTo, filterSeparation]);

    const sorted = useMemo(() => [...filtered].sort((a, b) => {
        const av = sortKey === 'deleted_by' ? (a.deleted_by?.name ?? '') : (a[sortKey] ?? '');
        const bv = sortKey === 'deleted_by' ? (b.deleted_by?.name ?? '') : (b[sortKey] ?? '');
        if (av < bv) return sortAsc ? -1 : 1;
        if (av > bv) return sortAsc ? 1 : -1;
        return 0;
    }), [filtered, sortKey, sortAsc]);

    const separationCounts = useMemo(() => {
        const counts = {};
        filtered.forEach(m => {
            const k = m.separation_type ?? 'unknown';
            counts[k] = (counts[k] ?? 0) + 1;
        });
        return counts;
    }, [filtered]);

    const handleSort = (key) => {
        if (sortKey === key) setSortAsc(a => !a);
        else { setSortKey(key); setSortAsc(true); }
    };

    const sortIndicator = (key) => sortKey === key
        ? <span className="archivedMembersPage__sortIndicator">{sortAsc ? '▲' : '▼'}</span>
        : null;

    if (isLoading) return <div className="archivedMembersPage"><p>Loading…</p></div>;
    if (error) return <div className="archivedMembersPage"><p>Failed to load archived members.</p></div>;

    return (
        <div className="archivedMembersPage">
            <div className="archivedMembersPage__header">
                <h1>Archived Members</h1>
            </div>

            <div className="archivedMembersPage__filters">
                <div className="archivedMembersPage__filterGroup">
                    <label>Team</label>
                    <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
                        <option value="">All teams</option>
                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="archivedMembersPage__filterGroup">
                    <label>Last working day from</label>
                    <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
                </div>
                <div className="archivedMembersPage__filterGroup">
                    <label>Last working day to</label>
                    <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
                </div>
                <div className="archivedMembersPage__filterGroup">
                    <label>Separation type</label>
                    <select value={filterSeparation} onChange={e => setFilterSeparation(e.target.value)}>
                        <option value="">All types</option>
                        {Object.entries(SEPARATION_LABELS).map(([v, l]) =>
                            <option key={v} value={v}>{l}</option>
                        )}
                    </select>
                </div>
            </div>

            <div className="archivedMembersPage__summary">
                <span><strong>Total:</strong> {filtered.length}</span>
                {Object.entries(separationCounts).map(([k, n]) => (
                    <span key={k}><strong>{SEPARATION_LABELS[k] ?? k}:</strong> {n}</span>
                ))}
            </div>

            {sorted.length === 0 ? (
                <p className="archivedMembersPage__empty">No archived members match the current filters.</p>
            ) : (
                <table className="archivedMembersPage__table">
                    <thead>
                        <tr>
                            {COLUMNS.map(col => (
                                <th key={col.key} onClick={() => handleSort(col.key)}>
                                    {col.label}{sortIndicator(col.key)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(m => (
                            <tr key={m.uid}>
                                <td>{m.name}</td>
                                <td>{m.team_name}</td>
                                <td>{m.country}</td>
                                <td>{formatDate(m.employee_start_date)}</td>
                                <td>{formatDate(m.last_working_day)}</td>
                                <td>{formatTenure(m.employee_start_date, m.last_working_day)}</td>
                                <td><SeparationBadge value={m.separation_type} /></td>
                                <td>{m.deleted_by?.name ?? '—'}</td>
                                <td>{m.deleted_at ? m.deleted_at.slice(0, 10) : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default ArchivedMembersPage;
