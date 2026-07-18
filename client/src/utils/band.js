// Official IELTS overall band rounding: the average of the section bands is
// rounded to the nearest whole or half band, with anything ending in .25
// rounding UP to the next half band and anything ending in .75 rounding UP
// to the next whole band (i.e. round-half-up on avg*2, then /2).
//   3.125 -> 3.0   3.25 -> 3.5   3.365 -> 3.5   3.625 -> 3.5   3.75 -> 4.0
export function roundBand(avg) {
  if (avg == null || Number.isNaN(avg)) return null;
  return (Math.round(avg * 2) / 2).toFixed(1);
}

// True once a teacher has actually approved the attempt (or it never needed
// approval in the first place, e.g. standalone reading/listening practice).
// While an attempt sits at 'pending_review' its band must never be shown to
// the student, even though an auto-estimate is already sitting in the row —
// that estimate is for the teacher's queue only.
export function isRevealed(a) {
  return !!a && a.status !== 'pending_review';
}

// The band to show the student for this attempt, or null if it's still
// awaiting teacher approval. Use this everywhere a band is rendered instead
// of reading `band_final ?? band_estimate` directly off the attempt.
export function displayBand(a) {
  if (!isRevealed(a)) return null;
  return a.band_final ?? a.band_estimate ?? null;
}
