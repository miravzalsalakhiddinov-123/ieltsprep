// A single click-to-flip vocabulary flashcard, styled after a real paper
// index card (ruled lines, red margin rule, folded corner tab) rather than
// a generic gradient app tile. Front shows the English word, back shows
// the Russian translation — same card, same materials, just turned over.
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
          <div className="vocab-flashcard-body">
            <span className="vocab-flashcard-word">{english}</span>
            <span className="vocab-flashcard-meta">English</span>
          </div>
          <div className="vocab-flashcard-footer">tap to flip</div>
        </div>
        <div className="vocab-flashcard-face vocab-flashcard-back">
          <div className="vocab-flashcard-body">
            <span className="vocab-flashcard-word">{russian}</span>
            <span className="vocab-flashcard-meta">Russian</span>
          </div>
          <div className="vocab-flashcard-footer">tap to flip</div>
        </div>
      </div>
    </div>
  );
}
