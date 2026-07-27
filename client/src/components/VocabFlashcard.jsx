// A single click-to-flip vocabulary flashcard. Front shows the English word,
// back shows the Russian translation. Both faces share the app's teal/cyan
// brand gradient (just inverted) instead of arbitrary blue/green blocks, so
// flipping feels like one consistent object turning over, not a color swap.
export default function VocabFlashcard({ english, russian, flipped, onFlip }) {
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
      aria-label={flipped ? `Russian: ${russian}` : `English: ${english}`}
    >
      <div className="vocab-flashcard-inner">
        <div className="vocab-flashcard-face vocab-flashcard-front">
          <span className="vocab-flashcard-tag">EN</span>
          <span className="vocab-flashcard-word">{english}</span>
          <span className="vocab-flashcard-hint">⟳ Tap to flip</span>
        </div>
        <div className="vocab-flashcard-face vocab-flashcard-back">
          <span className="vocab-flashcard-tag">RU</span>
          <span className="vocab-flashcard-word">{russian}</span>
          <span className="vocab-flashcard-hint">⟳ Tap to flip</span>
        </div>
      </div>
    </div>
  );
}
