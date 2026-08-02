import { Target, BookOpen, Headphones, PenLine, Mic } from 'lucide-react';

const SKILLS = [
  { icon: BookOpen, label: 'Reading', color: 'var(--accent)' },
  { icon: Headphones, label: 'Listening', color: '#2e9aa6' },
  { icon: PenLine, label: 'Writing', color: 'var(--warn)' },
  { icon: Mic, label: 'Speaking', color: '#a855f7' }
];

export default function About() {
  return (
    <div>
      <div className="section-head">
        <div>
          <div className="section-head-title">About</div>
          <div className="section-head-sub">What this platform is, and how to get the most out of it.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Target size={17} strokeWidth={2} color="var(--accent)" /> Our mission</h3>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          IELTS Prep helps you practice all four IELTS skills, track your band progress over time,
          and get feedback from your teacher — all in one place.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>What you can do here</h3>
        <div className="grid grid-2" style={{ marginTop: 10 }}>
          {SKILLS.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="hub-card-icon" style={{ '--card-accent': s.color, width: 36, height: 36, borderRadius: 10, margin: 0 }}>
                <s.icon size={16} strokeWidth={2} color={s.color} />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.label} practice & full mocks</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Need help?</h3>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
          Message your teacher directly from your dashboard inbox, or reach out through the usual channels.
        </p>
      </div>
    </div>
  );
}
