import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';
import { api } from '../api/client';
import { getStoredVocabLang, setStoredVocabLang } from '../utils/vocabLang';

export default function VocabularySets() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState(null);
  const [sets, setSets] = useState(null);
  const [translationLang, setTranslationLang] = useState(getStoredVocabLang);

  useEffect(() => {
    setSets(null);
    setCategory(null);
    api.listVocabCategories().then(cats => setCategory(cats.find(c => String(c.id) === String(categoryId)) || null));
    api.listVocabSets(categoryId).then(setSets);
  }, [categoryId]);

  function chooseLang(lang) {
    setTranslationLang(lang);
    setStoredVocabLang(lang);
  }

  return (
    <div>
      <div className="topbar-row">
        <button className="btn secondary" onClick={() => navigate('/vocabulary')}>← Back to Vocabulary</button>
      </div>

      <div className="lessons-hero">
        <span className="lessons-hero-eyebrow">🗂️ {category ? category.name : '…'}</span>
        <div className="welcome-title">Choose a set</div>
        <div className="welcome-sub">Choose a set to study.</div>
      </div>

      <div className="vocab-lang-toggle">
        <button type="button" className={`vocab-lang-btn${translationLang === 'russian' ? ' active' : ''}`} onClick={() => chooseLang('russian')}>Russian</button>
        <button type="button" className={`vocab-lang-btn${translationLang === 'uzbek' ? ' active' : ''}`} onClick={() => chooseLang('uzbek')}>Uzbek</button>
      </div>

      {sets && sets.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><FolderOpen size={22} strokeWidth={2} /></div>
            <div className="empty-state-title">No sets yet</div>
            <div className="empty-state-sub">Ask your teacher to add vocabulary sets to this category.</div>
          </div>
        </div>
      )}

      <div className="vocab-set-grid">
        {sets && sets.map(s => (
          <div className="vocab-set-card" key={s.id} onClick={() => navigate(`/vocabulary/set/${s.id}`)}>
            <span className="vocab-set-card-icon">🗂️</span>
            <div>
              <div className="vocab-set-card-title">{s.name}</div>
              <div className="vocab-set-card-meta">
                {s.word_count} word{s.word_count === 1 ? '' : 's'} · {[s.has_text1, s.has_text2].filter(Boolean).length} text{[s.has_text1, s.has_text2].filter(Boolean).length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
