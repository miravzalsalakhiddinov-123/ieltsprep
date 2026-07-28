const KEY = 'vocab_translation_lang';

export function getStoredVocabLang() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'uzbek' ? 'uzbek' : 'russian';
  } catch {
    return 'russian';
  }
}

export function setStoredVocabLang(lang) {
  try {
    localStorage.setItem(KEY, lang === 'uzbek' ? 'uzbek' : 'russian');
  } catch {
    // ignore (e.g. storage disabled)
  }
}
