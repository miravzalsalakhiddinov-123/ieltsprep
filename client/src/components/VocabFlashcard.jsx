// A single click-to-flip vocabulary flashcard, styled as a plain, spacious
// card (in the spirit of Quizlet's flashcard view) rather than a decorated
// tile. Front shows the English word, back shows the translation in
// whichever language the student picked (Russian or Uzbek).
export default function VocabFlashcard({ english, translation, translationLabel = 'Russian', flipped, onFlip }) {
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFlip();
    }
  }

  return (
    <div
      className={`vocab-flashcard${flipped ? ' flipped' : ''}`}
      onClick={onFlip}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={flipped ? `${translationLabel}: ${translation}` : `English: ${english}`}
    >
      <div className="vocab-flashcard-inner">
        <div className="vocab-flashcard-face vocab-flashcard-front">
          <span className="vocab-flashcard-label">English</span>
          <span className="vocab-flashcard-corner">⟲</span>
          <span className="vocab-flashcard-word">{english}</span>
          <span className="vocab-flashcard-hint">Tap to flip</span>
        </div>
        <div className="vocab-flashcard-face vocab-flashcard-back">
          <span className="vocab-flashcard-label">{translationLabel}</span>
          <span className="vocab-flashcard-corner">⟲</span>
          <span className="vocab-flashcard-word">{translation}</span>
          <span className="vocab-flashcard-hint">Tap to flip</span>
        </div>
      </div>
    </div>
  );
}
