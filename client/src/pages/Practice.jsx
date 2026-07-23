import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Headphones, PenLine, Search, Clock, CalendarDays, BookMarked, CheckCircle2, Play, BarChart3, FileText, ClipboardCheck } from 'lucide-react';
import { api } from '../api/client';
import FilterDropdown from '../components/FilterDropdown';

const TYPES = [
  { key: 'reading', label: 'Reading', icon: BookOpen, color: 'var(--accent)' },
  { key: 'listening', label: 'Listening', icon: Headphones, color: 'var(--accent-2)' },
  { key: 'writing', label: 'Writing', icon: PenLine, color: 'var(--warn)' }
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// A small filled circle with the passage/part number in it — used instead of
// numbered emoji (1️⃣, 2️⃣…), which render inconsistently across platforms
// and read as an obvious placeholder rather than a deliberate icon choice.
function NumberBadge({ n }) {
  return <span className="number-badge">{n}</span>;
}

// Sub-navigation shown under each skill: the whole test, or one section of
// it at a time. Reading always has 3 passages, Listening always has 4 parts
// (standard IELTS structure); Writing has its 2 tasks.
const SCOPE_TABS = {
  reading: [
    { key: 'full', label: 'Full Tests', icon: BookOpen },
    { key: 'part-1', label: 'Passage 1', icon: () => <NumberBadge n={1} /> },
    { key: 'part-2', label: 'Passage 2', icon: () => <NumberBadge n={2} /> },
    { key: 'part-3', label: 'Passage 3', icon: () => <NumberBadge n={3} /> }
  ],
  listening: [
    { key: 'full', label: 'Full Tests', icon: Headphones },
    { key: 'part-1', label: 'Part 1', icon: () => <NumberBadge n={1} /> },
    { key: 'part-2', label: 'Part 2', icon: () => <NumberBadge n={2} /> },
    { key: 'part-3', label: 'Part 3', icon: () => <NumberBadge n={3} /> },
    { key: 'part-4', label: 'Part 4', icon: () => <NumberBadge n={4} /> }
  ],
  writing: [
    { key: 'full', label: 'Full Test', icon: PenLine },
    { key: 'task1', label: 'Task 1 Only', icon: BarChart3 },
    { key: 'task2', label: 'Task 2 Only', icon: FileText }
  ]
};

// Short badge text shown on a card so a single passage/part/task is
// identifiable at a glance, even when the type/scope tabs aren't visible.
function scopeBadge(type, t) {
  if (type === 'writing') {
    if (t.writing_tasks === 'task1') return 'Task 1';
    if (t.writing_tasks === 'task2') return 'Task 2';
    return null; // full writing test — no badge needed
  }
  if (t.part_scope === 'part' && t.part_number) {
    return type === 'reading' ? `Passage ${t.part_number}` : `Part ${t.part_number}`;
  }
  return null;
}

function matchesScope(type, t, scopeKey) {
  if (scopeKey === 'full') {
    return type === 'writing' ? (t.writing_tasks || 'both') === 'both' : t.part_scope !== 'part';
  }
  if (type === 'writing') return t.writing_tasks === scopeKey;
  const n = parseInt(scopeKey.split('-')[1], 10);
  return t.part_scope === 'part' && t.part_number === n;
}

export default function Practice() {
  const [type, setType] = useState('reading');
  const [scope, setScope] = useState('full');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [tests, setTests] = useState(null); // null = loading
  const navigate = useNavigate();
  const meta = TYPES.find(t => t.key === type);
  const scopeTabs = SCOPE_TABS[type];

  useEffect(() => {
    setTests(null);
    // Single request: the list and each test's most-recent-attempt-id come
    // back together, instead of two separate round trips.
    api.testsWithProgress(type).then(setTests);
  }, [type]);

  function chooseType(t) {
    setType(t);
    setScope('full');
    setSearch('');
  }

  const filtered = useMemo(() => {
    if (!tests) return [];
    let rows = tests.filter(t => matchesScope(type, t, scope));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(t => t.title.toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) => sort === 'newest'
      ? new Date(b.created_at) - new Date(a.created_at)
      : new Date(a.created_at) - new Date(b.created_at));
    return rows;
  }, [tests, type, scope, search, sort]);

  function openTest(t) {
    // Already completed this one — open the read-only Analyze view instead
    // of starting a brand new attempt over it.
    if (t.attempt_id) navigate(`/practice/${type}/${t.id}/review/${t.attempt_id}`);
    else navigate(`/practice/${type}/${t.id}`);
  }

  return (
    <div>
      <div className="topbar-row">
        <div>
          <div className="welcome-title">Practice</div>
          <div className="welcome-sub">Pick a skill, then a full test or a single section, and it will open in full screen.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TYPES.map(t => (
          <button key={t.key} className="btn secondary"
            style={{ borderColor: type === t.key ? t.color : 'var(--border)', color: type === t.key ? t.color : 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => chooseType(t.key)}>
            <t.icon size={16} strokeWidth={2} /> {t.label}
          </button>
        ))}
      </div>

      <div className="type-tabs" style={{ marginBottom: 16 }}>
        {scopeTabs.map(s => (
          <button type="button" key={s.key} className={'type-tab' + (scope === s.key ? ' active' : '')} onClick={() => setScope(s.key)}>
            <span className="type-tab-icon"><s.icon size={15} strokeWidth={2} /></span>{s.label}
          </button>
        ))}
      </div>

      <div className="lesson-filters">
        <div className="search-box">
          <span className="search-box-icon"><Search size={14} strokeWidth={2} /></span>
          <input className="input search-box-input" placeholder="Search tests…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <FilterDropdown
          icon={<Clock size={14} strokeWidth={2} />}
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: 'Newest First' },
            { value: 'oldest', label: 'Oldest First' }
          ]}
        />
        {tests !== null && (
          <span className="lesson-count-pill">{filtered.length} test{filtered.length === 1 ? '' : 's'} found</span>
        )}
      </div>

      {tests === null && (
        <div className="practice-grid">
          {[0, 1, 2].map(i => <div className="practice-card-skeleton" key={i} />)}
        </div>
      )}

      {tests !== null && filtered.length === 0 && (
        <div className="card" style={{ color: 'var(--text-muted)' }}>
          {tests.length === 0
            ? `No ${meta.label.toLowerCase()} tests uploaded yet — ask your teacher.`
            : 'No tests match this filter yet — try a different section or search.'}
        </div>
      )}

      {tests !== null && filtered.length > 0 && (
        <div className="practice-grid">
          {filtered.map(t => {
            const isNew = Date.now() - new Date(t.created_at).getTime() < WEEK_MS;
            const done = !!t.attempt_id;
            const badge = scopeBadge(type, t);
            return (
              <div className="practice-card" key={t.id} style={{ '--card-accent': meta.color }}>
                <div className="practice-card-topbar" />
                <div className="practice-card-body">
                  <div className="practice-card-head">
                    <div className="practice-card-icon"><meta.icon size={16} strokeWidth={2} /></div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {badge && <span className="practice-card-tag part">{badge}</span>}
                      {done
                        ? <span className="practice-card-tag done"><CheckCircle2 size={11} strokeWidth={2.5} style={{ verticalAlign: -1.5, marginRight: 3 }} />Completed</span>
                        : isNew ? <span className="practice-card-tag new">New</span> : null}
                    </div>
                  </div>
                  <div className="practice-card-title">{t.title}</div>
                  <div className="practice-card-meta">
                    {t.duration_minutes && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={12} strokeWidth={2} />{t.duration_minutes} min</span>}
                    {t.reading_variant && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><BookMarked size={12} strokeWidth={2} />{t.reading_variant}</span>}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><CalendarDays size={12} strokeWidth={2} />{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                  <button className="practice-card-btn" onClick={() => openTest(t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {done
                      ? <><ClipboardCheck size={14} strokeWidth={2} /> Analyze Results</>
                      : <><Play size={13} strokeWidth={2} fill="currentColor" /> Start {badge ? badge : meta.label + ' Test'}</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
