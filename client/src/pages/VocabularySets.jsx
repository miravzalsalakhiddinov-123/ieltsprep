import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';

export default function VocabularySets() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState(null);
  const [sets, setSets] = useState(null);
  // Which set's language picker is currently open (null = none)
  const [choosingSetId, setChoosingSetId] = useState(null);

  function startSet(setIdToStart, lang) {
    setChoosingSetId(null);
    navigate(`/vocabulary/set/${setIdToStart}?lang=${lang}`);
  }

  useEffect(() => {
    setSets(null);
    setCategory(null);
    api.listVocabCategories().then(cats => setCategory(cats.find(c => String(c.id) === String(categoryId)) || null));
    api.listVocabSets(categoryId).then(setSets);
  }, [categoryId]);

  return (
    <div>
      <div className="topbar-row">
        <button className="btn secondary" onClick={() => navigate('/vocabulary')}>← Back to Vocabulary</button>
      </div>

      <div className="lessons-hero">
        <span className="lessons-hero-eyebrow">🗂️ {category ? category.name : '…'}</span>
        <div className="welcome-title">Choose a set</div>
        <div className="welcome-sub">Each set has its own words, reading texts, and recall check.</div>
      </div>

      {sets && sets.length === 0 && (
        <div style={{ color: 'var(--text-muted)' }}>No sets in this category yet — ask your teacher to add some.</div>
      )}

      <div className="vocab-set-grid">
        {sets && sets.map(s => (
          <div
            className="vocab-set-card"
            key={s.id}
            onClick={() => setChoosingSetId(choosingSetId === s.id ? null : s.id)}
          >
            <div className="vocab-set-card-title">{s.name}</div>
            {choosingSetId === s.id ? (
              <div className="vocab-set-card-lang-row" onClick={e => e.stopPropagation()}>
                <button className="btn secondary vocab-set-card-lang-btn" onClick={() => startSet(s.id, 'ru')}>🇷🇺 Russian</button>
                <button className="btn secondary vocab-set-card-lang-btn" onClick={() => startSet(s.id, 'uz')}>🇺🇿 Uzbek</button>
              </div>
            ) : (
              <button className="btn vocab-set-card-btn">Start →</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
