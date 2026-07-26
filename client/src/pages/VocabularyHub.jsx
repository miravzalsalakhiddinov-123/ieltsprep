import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const ICONS = ['📖', '🗂️', '🧩', '🌱', '🚀', '🎯', '🔤', '🏙️', '🌍', '💼'];

export default function VocabularyHub() {
  const [categories, setCategories] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { api.listVocabCategories().then(setCategories); }, []);

  return (
    <div>
      <div className="lessons-hero">
        <span className="lessons-hero-eyebrow">🗣️ Vocabulary Trainer</span>
        <div className="welcome-title">Vocabulary</div>
        <div className="welcome-sub">Choose a category to start learning words with flashcards, reading, and recall.</div>
      </div>

      {categories === null && <div style={{ color: 'var(--text-muted)' }}>Loading…</div>}

      {categories && categories.length === 0 && (
        <div style={{ color: 'var(--text-muted)' }}>No vocabulary categories yet — ask your teacher to add some.</div>
      )}

      <div className="hub-grid">
        {categories && categories.map((c, i) => (
          <div
            className="hub-card"
            key={c.id}
            style={{ '--card-accent': i % 2 === 0 ? 'var(--accent)' : 'var(--accent-2)' }}
            onClick={() => navigate(`/vocabulary/${c.id}`)}
          >
            <div className="hub-card-icon">{ICONS[i % ICONS.length]}</div>
            <div className="hub-card-title">{c.name}</div>
            <span className="hub-card-badge">{c.set_count} set{c.set_count === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
