import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import RichTextField from '../../components/RichTextField';

export default function AdminVocabulary() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sets, setSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState(null); // full set object from getVocabSet

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSetName, setNewSetName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // word form
  const [wordEnglish, setWordEnglish] = useState('');
  const [wordRussian, setWordRussian] = useState('');
  const [editingWordId, setEditingWordId] = useState(null);
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  // set fields (name + texts), editable inline once a set is selected
  const [setName, setSetName] = useState('');
  const [text1Title, setText1Title] = useState('');
  const [text1Body, setText1Body] = useState('');
  const [text2Title, setText2Title] = useState('');
  const [text2Body, setText2Body] = useState('');

  function refreshCategories() { api.listVocabCategories().then(setCategories); }
  useEffect(refreshCategories, []);

  function openCategory(cat) {
    setSelectedCategory(cat);
    setSelectedSet(null);
    setSets([]);
    api.listVocabSets(cat.id).then(setSets);
  }

  function refreshSets() {
    if (selectedCategory) api.listVocabSets(selectedCategory.id).then(setSets);
  }

  function openSet(setSummary) {
    api.getVocabSet(setSummary.id).then(full => {
      setSelectedSet(full);
      setSetName(full.name);
      setText1Title(full.text1_title || '');
      setText1Body(full.text1_body || '');
      setText2Title(full.text2_title || '');
      setText2Body(full.text2_body || '');
      setEditingWordId(null); setWordEnglish(''); setWordRussian(''); setShowBulk(false); setBulkText('');
    });
  }

  function refreshSelectedSet() {
    if (selectedSet) api.getVocabSet(selectedSet.id).then(setSelectedSet);
  }

  async function addCategory(e) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setBusy(true); setError('');
    try {
      await api.createVocabCategory(newCategoryName.trim());
      setNewCategoryName('');
      refreshCategories();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function removeCategory(id) {
    if (!confirm('Delete this category? All its sets and words will be deleted too.')) return;
    await api.deleteVocabCategory(id);
    if (selectedCategory?.id === id) { setSelectedCategory(null); setSets([]); setSelectedSet(null); }
    refreshCategories();
  }

  async function addSet(e) {
    e.preventDefault();
    if (!newSetName.trim() || !selectedCategory) return;
    setBusy(true); setError('');
    try {
      await api.createVocabSet(selectedCategory.id, newSetName.trim());
      setNewSetName('');
      refreshSets();
      refreshCategories();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function removeSet(id) {
    if (!confirm('Delete this set? All its words will be deleted too.')) return;
    await api.deleteVocabSet(id);
    if (selectedSet?.id === id) setSelectedSet(null);
    refreshSets();
    refreshCategories();
  }

  async function saveSetDetails(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.updateVocabSet(selectedSet.id, {
        name: setName, text1_title: text1Title, text1_body: text1Body, text2_title: text2Title, text2_body: text2Body
      });
      refreshSelectedSet();
      refreshSets();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function submitWord(e) {
    e.preventDefault();
    if (!wordEnglish.trim() || !wordRussian.trim()) return;
    setBusy(true); setError('');
    try {
      if (editingWordId) await api.updateVocabWord(editingWordId, wordEnglish.trim(), wordRussian.trim());
      else await api.addVocabWord(selectedSet.id, wordEnglish.trim(), wordRussian.trim());
      setWordEnglish(''); setWordRussian(''); setEditingWordId(null);
      refreshSelectedSet();
      refreshSets();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  function editWord(w) {
    setEditingWordId(w.id); setWordEnglish(w.english); setWordRussian(w.russian);
  }

  async function removeWord(id) {
    if (!confirm('Delete this word?')) return;
    await api.deleteVocabWord(id);
    if (editingWordId === id) { setEditingWordId(null); setWordEnglish(''); setWordRussian(''); }
    refreshSelectedSet();
    refreshSets();
  }

  async function submitBulk(e) {
    e.preventDefault();
    if (!bulkText.trim()) return;
    setBusy(true); setError('');
    try {
      await api.bulkAddVocabWords(selectedSet.id, bulkText);
      setBulkText(''); setShowBulk(false);
      refreshSelectedSet();
      refreshSets();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="topbar-row"><div className="welcome-title">Vocabulary</div></div>
      {error && <div className="error-text">{error}</div>}

      <div className="vocab-admin-columns">
        {/* Column 1: categories */}
        <div className="card">
          <h3>Categories</h3>
          <form onSubmit={addCategory} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input className="input" placeholder="New category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
            <button className="btn" disabled={busy}>Add</button>
          </form>
          <div className="vocab-admin-list">
            {categories.map(c => (
              <div key={c.id} className={`vocab-admin-list-item${selectedCategory?.id === c.id ? ' active' : ''}`} onClick={() => openCategory(c)}>
                <span>{c.name}</span>
                <span className="vocab-admin-list-meta">
                  {c.set_count} set{c.set_count === 1 ? '' : 's'}
                  <button type="button" className="btn danger vocab-admin-mini-btn" onClick={e => { e.stopPropagation(); removeCategory(c.id); }}>✕</button>
                </span>
              </div>
            ))}
            {categories.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No categories yet.</div>}
          </div>
        </div>

        {/* Column 2: sets within selected category */}
        <div className="card">
          <h3>Sets{selectedCategory ? ` — ${selectedCategory.name}` : ''}</h3>
          {!selectedCategory && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Select a category first.</div>}
          {selectedCategory && (
            <>
              <form onSubmit={addSet} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <input className="input" placeholder="New set name" value={newSetName} onChange={e => setNewSetName(e.target.value)} />
                <button className="btn" disabled={busy}>Add</button>
              </form>
              <div className="vocab-admin-list">
                {sets.map(s => (
                  <div key={s.id} className={`vocab-admin-list-item${selectedSet?.id === s.id ? ' active' : ''}`} onClick={() => openSet(s)}>
                    <span>{s.name}</span>
                    <span className="vocab-admin-list-meta">
                      {s.word_count} word{s.word_count === 1 ? '' : 's'}
                      <button type="button" className="btn danger vocab-admin-mini-btn" onClick={e => { e.stopPropagation(); removeSet(s.id); }}>✕</button>
                    </span>
                  </div>
                ))}
                {sets.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No sets yet.</div>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Selected set detail: texts + words */}
      {selectedSet && (
        <div className="grid grid-2" style={{ marginTop: 18 }}>
          <div className="card">
            <h3>Set details — {selectedSet.name}</h3>
            <form onSubmit={saveSetDetails}>
              <div className="field"><label>Set name</label>
                <input className="input" value={setName} onChange={e => setSetName(e.target.value)} /></div>
              <div className="field"><label>Text 1 — title</label>
                <input className="input" value={text1Title} onChange={e => setText1Title(e.target.value)} placeholder="e.g. A Day at the Airport" /></div>
              <RichTextField label="Text 1 — content" value={text1Body} onChange={setText1Body} rows={6}
                placeholder="Write a short text that uses the words from this set…" />
              <div className="field"><label>Text 2 — title</label>
                <input className="input" value={text2Title} onChange={e => setText2Title(e.target.value)} placeholder="e.g. Planning a Trip" /></div>
              <RichTextField label="Text 2 — content" value={text2Body} onChange={setText2Body} rows={6}
                placeholder="Write a second short text that uses the words from this set…" />
              <button className="btn" disabled={busy}>Save set details</button>
            </form>
          </div>

          <div className="card">
            <h3>Words ({selectedSet.words.length})</h3>
            <form onSubmit={submitWord} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input className="input" placeholder="English" value={wordEnglish} onChange={e => setWordEnglish(e.target.value)} />
              <input className="input" placeholder="Russian" value={wordRussian} onChange={e => setWordRussian(e.target.value)} />
              <button className="btn" disabled={busy}>{editingWordId ? 'Save' : 'Add'}</button>
              {editingWordId && <button type="button" className="btn secondary" onClick={() => { setEditingWordId(null); setWordEnglish(''); setWordRussian(''); }}>Cancel</button>}
            </form>

            <button type="button" className="btn secondary" style={{ marginBottom: 12 }} onClick={() => setShowBulk(v => !v)}>
              {showBulk ? 'Hide bulk add' : 'Bulk add words'}
            </button>
            {showBulk && (
              <form onSubmit={submitBulk} style={{ marginBottom: 14 }}>
                <div className="field">
                  <textarea className="input" rows={5} value={bulkText} onChange={e => setBulkText(e.target.value)}
                    placeholder={'One word per line, e.g.:\napple - яблоко\nbook - книга'} />
                  <div className="field-hint">One pair per line, separated by " - ", "=", ":" or a tab.</div>
                </div>
                <button className="btn" disabled={busy}>Add all lines</button>
              </form>
            )}

            <table className="simple-table">
              <thead><tr><th>English</th><th>Russian</th><th></th></tr></thead>
              <tbody>
                {selectedSet.words.map(w => (
                  <tr key={w.id}>
                    <td>{w.english}</td>
                    <td>{w.russian}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn secondary vocab-admin-mini-btn" onClick={() => editWord(w)}>Edit</button>
                      <button className="btn danger vocab-admin-mini-btn" onClick={() => removeWord(w.id)}>✕</button>
                    </td>
                  </tr>
                ))}
                {selectedSet.words.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--text-muted)' }}>No words yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
