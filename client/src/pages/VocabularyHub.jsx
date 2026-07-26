import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const ICONS = ['📖', '🗂️', '🧩', '🌱', '🚀', '🎯', '🔤', '🏙️', '🌍', '💼'];
const ACCENTS = ['#7c3aed', '#0ea5c8', '#e0a30a', '#e0403a', '#16a34a', '#db2777'];

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

      <div className="vocab-hub-grid">
        {categories && categories.map((c, i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          const empty = c.set_count === 0;
          return (
            <div
              className={`vocab-hub-card${empty ? ' empty' : ''}`}
              key={c.id}
              style={{ '--card-accent': accent }}
              onClick={() => !empty && navigate(`/vocabulary/${c.id}`)}
            >
              <div className="vocab-hub-card-bar" />
              <div className="vocab-hub-card-body">
                <div className="vocab-hub-card-icon">{ICONS[i % ICONS.length]}</div>
                <div className="vocab-hub-card-title">{c.name}</div>
                {c.description && <div className="vocab-hub-card-desc">{c.description}</div>}
                {empty
                  ? <span className="vocab-hub-card-badge soon">Coming soon</span>
                  : <span className="vocab-hub-card-badge">{c.set_count} set{c.set_count === 1 ? '' : 's'}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
