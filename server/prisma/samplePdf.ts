// Tiny dependency-free PDF generator for seeding sample document scans.
//
// We don't ship real land-record scans (and shouldn't), so the seed needs to
// fabricate believable-looking one-page PDFs on the fly. A full PDF library is
// overkill — a single-page PDF with a few lines of text is a handful of objects
// we can assemble by hand. This keeps the project dependency-light and portable.

// Escape the characters that are special inside a PDF string literal.
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Build a one-page PDF. `title` is drawn large; `lines` are body text.
export function makePdf(title: string, lines: string[]): Buffer {
  // Compose the page's content stream (text drawing commands).
  const body: string[] = [];
  body.push("BT", "/F1 20 Tf", "72 720 Td", `(${esc(title)}) Tj`, "ET");
  let y = 680;
  for (const line of lines) {
    body.push("BT", "/F1 12 Tf", `72 ${y} Td`, `(${esc(line)}) Tj`, "ET");
    y -= 22;
  }
  const content = body.join("\n");

  // PDF objects.
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  );
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  // Assemble the file, recording byte offsets for the xref table.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
