// Official IELTS overall band rounding: the average of the section bands is
// rounded to the nearest whole or half band, with anything ending in .25
// rounding UP to the next half band and anything ending in .75 rounding UP
// to the next whole band (i.e. round-half-up on avg*2, then /2).
//   3.125 -> 3.0   3.25 -> 3.5   3.365 -> 3.5   3.625 -> 3.5   3.75 -> 4.0
export function roundBand(avg) {
  if (avg == null || Number.isNaN(avg)) return null;
  return (Math.round(avg * 2) / 2).toFixed(1);
}
