import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Initialize PDF.js worker using CDN matching installed rock-solid version 3.11.174
if (typeof window !== 'undefined' && pdfjsLib?.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

export async function parseFileToParagraphs(file: File): Promise<string[]> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (extension === 'txt') {
    const text = await file.text();
    return parseTxtToParagraphs(text);
  } else if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return parseDocxToParagraphs(result.value);
  } else if (extension === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();
    return await parsePdfToParagraphs(arrayBuffer);
  } else {
    // Generic text fallback
    const text = await file.text();
    return parseTxtToParagraphs(text);
  }
}

function parseTxtToParagraphs(rawText: string): string[] {
  // Split on double line breaks or blank lines
  const rawParagraphs = rawText.split(/\r?\n\s*\r?\n/);
  const clean = rawParagraphs
    .map((p) => p.replace(/\r?\n/g, ' ').trim())
    .filter((p) => p.length > 0);

  if (clean.length === 0 && rawText.trim().length > 0) {
    return rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  }
  return clean;
}

function parseDocxToParagraphs(rawText: string): string[] {
  // Mammoth extracts text with newlines between paragraphs
  const rawParagraphs = rawText.split(/\r?\n+/);
  return rawParagraphs
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

async function parsePdfToParagraphs(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const paragraphs: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    let currentParagraph = '';
    let lastY: number | null = null;
    let lastHeight = 12;

    for (const item of textContent.items as any[]) {
      if (!item.str || item.str.trim() === '') {
        if (item.hasEOL && currentParagraph.length > 0 && !currentParagraph.endsWith(' ')) {
          currentParagraph += ' ';
        }
        continue;
      }

      const y = item.transform ? item.transform[5] : 0;
      const height = item.height || 12;

      if (lastY !== null) {
        const gap = Math.abs(lastY - y);
        // If vertical gap is significantly larger than standard line height -> paragraph boundary
        if (gap > Math.max(height * 1.6, 18) && currentParagraph.trim().length > 0) {
          paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        } else if (gap > 3 && !currentParagraph.endsWith(' ')) {
          currentParagraph += ' ';
        }
      }

      currentParagraph += item.str;
      lastY = y;
      lastHeight = height;
    }

    if (currentParagraph.trim().length > 0) {
      paragraphs.push(currentParagraph.trim());
    }
  }

  return paragraphs.filter((p) => p.trim().length > 0);
}
