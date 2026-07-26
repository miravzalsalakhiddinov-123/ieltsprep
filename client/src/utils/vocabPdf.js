// Builds a small, text-only PDF (built-in Helvetica font, no images) listing
// the words a student is still struggling with, so file size stays tiny —
// a full page of ~50 words is well under 20KB. jsPDF itself is loaded lazily
// (dynamic import) so it doesn't add weight to the app's main bundle.
export async function downloadWeakWordsPdf(setName, words) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const purple = [99, 60, 210];
  const purpleSoft = [240, 236, 253];
  let y = 66;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.text('Weak Words', margin, y);

  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(110, 110, 110);
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`${setName} \u00B7 ${words.length} word${words.length === 1 ? '' : 's'} to review \u00B7 generated ${dateStr}`, margin, y);

  y += 14;
  doc.setDrawColor(...purple);
  doc.setLineWidth(2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  const rowH = 24;
  const col1 = margin + 8;   // #
  const col2 = margin + 46;  // English
  const col3 = margin + 260; // Russian
  const tableRight = pageWidth - margin;
  const maxRussianWidth = tableRight - col3 - 8;

  function drawHeaderRow() {
    doc.setFillColor(...purple);
    doc.rect(margin, y, tableRight - margin, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('#', col1, y + 16);
    doc.text('ENGLISH', col2, y + 16);
    doc.text('RUSSIAN', col3, y + 16);
    y += rowH;
  }

  drawHeaderRow();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  words.forEach((w, i) => {
    const russianLines = doc.splitTextToSize(w.russian, maxRussianWidth);
    const thisRowH = Math.max(rowH, russianLines.length * 13 + 10);

    if (y + thisRowH > pageHeight - margin) {
      doc.addPage();
      y = 60;
      drawHeaderRow();
    }

    if (i % 2 === 0) {
      doc.setFillColor(...purpleSoft);
      doc.rect(margin, y, tableRight - margin, thisRowH, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(String(i + 1), col1, y + 16);
    doc.text(w.english, col2, y + 16);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 40, 140);
    doc.text(russianLines, col3, y + 16);

    y += thisRowH;
  });

  const fileSlug = setName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'set';
  doc.save(`weak-words-${fileSlug}.pdf`);
}
