// A single click-to-flip vocabulary flashcard. Front shows the English word
// (blue), back shows the Russian translation (green) — flipping is a simple
// CSS 3D rotate, no extra animation libraries needed.
export default function VocabFlashcard({ english, russian, flipped, onFlip }) {
  return (
    <div className={`vocab-flashcard${flipped ? ' flipped' : ''}`} onClick={onFlip}>
      <div className="vocab-flashcard-inner">
        <div className="vocab-flashcard-face vocab-flashcard-front">
          <span>{english}</span>
          <span className="vocab-flashcard-hint">tap to flip</span>
        </div>
        <div className="vocab-flashcard-face vocab-flashcard-back">
          <span>{russian}</span>
          <span className="vocab-flashcard-hint">tap to flip</span>
        </div>
      </div>
    </div>
  );
}
