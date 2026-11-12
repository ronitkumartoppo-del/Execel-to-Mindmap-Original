import React, { useState, useEffect, useRef } from 'react';
import { parseFileToParagraphs } from '../utils/fileParser';
import { Zap, Highlighter, Sun, Moon, ArrowLeft, UploadCloud, Loader2, X, Sparkles, BookOpen, Trash2 } from 'lucide-react';

export interface VibeHighlight {
  id: string;
  fileName: string;
  text: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  wordOffset: number;
  wordCount?: number;
  timestamp: number;
}

interface WordPopoverData {
  word: string;
  x: number;
  y: number;
  loading: boolean;
  partOfSpeech?: string;
  phonetic?: string;
  definition?: string;
  synonyms: string[];
  highlightId?: string;
}

interface VibeViewProps {
  onBack: () => void;
}

export default function VibeView({ onBack }: VibeViewProps) {
  const [fileData, setFileData] = useState<{ fileName: string; paragraphs: string[] } | null>(() => {
    const cached = localStorage.getItem('vibe_current_file_v1');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Failed to parse cached VIBE file:', e);
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHighlightMode, setIsHighlightMode] = useState<boolean>(false);
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [wordPopover, setWordPopover] = useState<WordPopoverData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load highlights from localStorage with initial state fallback
  const [highlights, setHighlights] = useState<VibeHighlight[]>(() => {
    const saved = localStorage.getItem('vibe_highlights_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse highlights:', e);
      }
    }
    return [];
  });

  // Re-apply highlights on component mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vibe_highlights_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setHighlights(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to re-apply highlights on mount:', e);
    }
  }, []);

  // Sync highlights if updated in another tab
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vibe_highlights_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setHighlights(parsed);
          }
        } catch (err) {
          console.error('Failed to sync highlights from storage event:', err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Close popover on escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWordPopover(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleProcessFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'docx', 'txt'].includes(extension)) {
      showToast('Please upload a PDF, DOCX, or TXT file.');
      return;
    }

    setIsLoading(true);
    try {
      const paragraphs = await parseFileToParagraphs(file);
      if (paragraphs.length === 0) {
        showToast('No readable text found in file.');
        setIsLoading(false);
        return;
      }

      const newFileData = { fileName: file.name, paragraphs };
      setFileData(newFileData);
      localStorage.setItem('vibe_current_file_v1', JSON.stringify(newFileData));
    } catch (err) {
      console.error('Error parsing document:', err);
      showToast('Failed to parse file. Please try another format.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Scroll Progress calculation
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const totalScrollable = scrollHeight - clientHeight;
      if (totalScrollable > 0) {
        const progress = Math.min(100, Math.max(0, (scrollTop / totalScrollable) * 100));
        setScrollProgress(progress);
      } else {
        setScrollProgress(0);
      }
    }
  };

  // Fetch word definition and 2-3 synonyms
  const lookupWord = async (rawWord: string, targetX: number, targetY: number, highlightId?: string) => {
    const cleanWord = rawWord.replace(/^[^\w]+|[^\w]+$/g, '').trim();
    if (!cleanWord || cleanWord.length < 2 || cleanWord.split(/\s+/).length > 4) {
      return;
    }

    // Set initial loading popover state
    setWordPopover({
      word: cleanWord,
      x: targetX,
      y: targetY,
      loading: true,
      synonyms: [],
      highlightId
    });

    let definition = '';
    let partOfSpeech = '';
    let phonetic = '';
    let synonyms: string[] = [];

    try {
      const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord.toLowerCase())}`);
      if (dictRes.ok) {
        const data = await dictRes.json();
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          phonetic = first.phonetic || first.phonetics?.find((p: any) => p.text)?.text || '';
          
          if (first.meanings && first.meanings.length > 0) {
            const m0 = first.meanings[0];
            partOfSpeech = m0.partOfSpeech || '';
            if (m0.definitions && m0.definitions.length > 0) {
              definition = m0.definitions[0].definition || '';
            }

            first.meanings.forEach((m: any) => {
              if (Array.isArray(m.synonyms)) synonyms.push(...m.synonyms);
              if (Array.isArray(m.definitions)) {
                m.definitions.forEach((d: any) => {
                  if (Array.isArray(d.synonyms)) synonyms.push(...d.synonyms);
                });
              }
            });
          }
        }
      }
    } catch (err) {
      console.warn('Dictionary lookup note:', err);
    }

    // Ensure we have 2-3 high-quality synonyms from Datamuse if needed
    if (synonyms.length < 3) {
      try {
        const synRes = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(cleanWord.toLowerCase())}&max=6`);
        if (synRes.ok) {
          const synList = await synRes.json();
          if (Array.isArray(synList)) {
            synonyms.push(...synList.map((s: any) => s.word));
          }
        }
        if (synonyms.length < 3) {
          const mlRes = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(cleanWord.toLowerCase())}&max=6`);
          if (mlRes.ok) {
            const mlList = await mlRes.json();
            if (Array.isArray(mlList)) {
              synonyms.push(...mlList.map((s: any) => s.word));
            }
          }
        }
      } catch (e) {
        console.warn('Synonym lookup note:', e);
      }
    }

    const cleanSynonyms = Array.from(new Set(synonyms))
      .filter((s) => s.toLowerCase() !== cleanWord.toLowerCase() && s.length > 1 && !s.includes(' '))
      .slice(0, 3);

    setWordPopover((prev) => {
      if (!prev || prev.word !== cleanWord) return prev;
      return {
        ...prev,
        loading: false,
        partOfSpeech,
        phonetic,
        definition: definition || 'Definition currently unavailable in offline dictionary index.',
        synonyms: cleanSynonyms,
        highlightId: highlightId || prev.highlightId
      };
    });
  };

  // Text selection handler for highlighting + word meaning popover
  const handleSelectionRelease = () => {
    if (!isHighlightMode || !fileData) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!anchorNode || !focusNode) return;

    const anchorElem = anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement;
    const focusElem = focusNode.nodeType === Node.ELEMENT_NODE ? (focusNode as Element) : focusNode.parentElement;

    const anchorPara = anchorElem?.closest('[data-vibe-para-index]');
    const focusPara = focusElem?.closest('[data-vibe-para-index]');

    if (!anchorPara || !focusPara || anchorPara !== focusPara) {
      showToast('Select within one paragraph for now ✌️');
      return;
    }

    const pIndexAttr = anchorPara.getAttribute('data-vibe-para-index');
    if (pIndexAttr === null) return;
    const pIndex = parseInt(pIndexAttr, 10);
    const pText = fileData.paragraphs[pIndex];
    if (pText === undefined) return;

    // Calculate selection bounding rect for popover positioning
    const range = selection.getRangeAt(0);
    let targetX = window.innerWidth / 2;
    let targetY = 120;
    try {
      const rect = range.getBoundingClientRect();
      const popoverWidth = 320;
      targetX = Math.min(Math.max(16, rect.left + rect.width / 2 - popoverWidth / 2), window.innerWidth - popoverWidth - 16);
      
      // Position above if close to bottom, otherwise below
      if (rect.bottom + 220 > window.innerHeight && rect.top > 240) {
        targetY = Math.max(70, rect.top - 200);
      } else {
        targetY = Math.min(window.innerHeight - 220, rect.bottom + 10);
      }
    } catch (e) {
      console.warn('Rect calc note:', e);
    }

    // Helper function to calculate character offset within the paragraph
    const getOffsetInParagraph = (root: Node, node: Node, offset: number): number => {
      try {
        const preRange = document.createRange();
        preRange.selectNodeContents(root);
        preRange.setEnd(node, offset);
        return preRange.toString().length;
      } catch (e) {
        return 0;
      }
    };

    let startChar = getOffsetInParagraph(anchorPara, range.startContainer, range.startOffset);
    let endChar = getOffsetInParagraph(anchorPara, range.endContainer, range.endOffset);

    if (startChar > endChar) {
      const tmp = startChar;
      startChar = endChar;
      endChar = tmp;
    }

    // Adjust offsets if selection was trimmed
    let finalStart = startChar;
    let finalEnd = endChar;

    while (finalStart < finalEnd && /\s/.test(pText[finalStart])) {
      finalStart++;
    }
    while (finalEnd > finalStart && /\s/.test(pText[finalEnd - 1])) {
      finalEnd--;
    }

    // Validate that slice matches selectedText or find accurate local position
    if (pText.slice(finalStart, finalEnd) !== selectedText) {
      const localSearch = pText.indexOf(selectedText, Math.max(0, startChar - 10));
      if (localSearch !== -1 && Math.abs(localSearch - startChar) < 30) {
        finalStart = localSearch;
        finalEnd = localSearch + selectedText.length;
      } else {
        const globalIdx = pText.indexOf(selectedText);
        if (globalIdx !== -1) {
          finalStart = globalIdx;
          finalEnd = globalIdx + selectedText.length;
        }
      }
    }

    // Calculate word offset (0-indexed count of words prior to this selection)
    const textBefore = pText.slice(0, finalStart).trim();
    const wordOffset = textBefore ? textBefore.split(/\s+/).length : 0;
    const wordCount = selectedText.split(/\s+/).filter(Boolean).length;

    const newHighlightId = `hl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newHighlight: VibeHighlight = {
      id: newHighlightId,
      fileName: fileData.fileName,
      text: selectedText,
      paragraphIndex: pIndex,
      startOffset: finalStart,
      endOffset: finalEnd,
      wordOffset: wordOffset,
      wordCount: wordCount,
      timestamp: Date.now()
    };

    setHighlights((prev) => {
      const isDuplicate = prev.some(
        (h) =>
          h.fileName === fileData.fileName &&
          h.paragraphIndex === pIndex &&
          h.startOffset === finalStart &&
          h.endOffset === finalEnd
      );
      if (isDuplicate) return prev;
      const updated = [...prev, newHighlight];
      localStorage.setItem('vibe_highlights_v1', JSON.stringify(updated));
      return updated;
    });

    // Lookup meaning and synonyms for the selected word/phrase
    lookupWord(selectedText, targetX, targetY, newHighlightId);

    selection.removeAllRanges();
  };

  const handleHighlightClick = (e: React.MouseEvent, text: string, highlightId?: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 320;
    const targetX = Math.min(Math.max(16, rect.left + rect.width / 2 - popoverWidth / 2), window.innerWidth - popoverWidth - 16);
    const targetY = rect.bottom + 220 > window.innerHeight && rect.top > 240
      ? Math.max(70, rect.top - 200)
      : Math.min(window.innerHeight - 220, rect.bottom + 10);

    lookupWord(text, targetX, targetY, highlightId);
  };

  const handleDeleteHighlight = (idToDelete: string) => {
    setHighlights((prev) => {
      const updated = prev.filter((h) => h.id !== idToDelete);
      localStorage.setItem('vibe_highlights_v1', JSON.stringify(updated));
      return updated;
    });
    setWordPopover(null);
    showToast('Highlight removed');
  };

  const renderParagraphContent = (pText: string, pIndex: number) => {
    if (!fileData) return pText;
    const currentHighlights = highlights.filter(
      (h) => h.fileName === fileData.fileName && h.paragraphIndex === pIndex && h.text
    );

    if (currentHighlights.length === 0) {
      return pText;
    }

    interface HighlightRange {
      start: number;
      end: number;
      text: string;
      id: string;
    }
    const ranges: HighlightRange[] = [];

    for (const hl of currentHighlights) {
      let start: number | null = null;
      let end: number | null = null;

      // 1. Exact startOffset & endOffset
      if (
        typeof hl.startOffset === 'number' &&
        typeof hl.endOffset === 'number' &&
        hl.startOffset >= 0 &&
        hl.endOffset <= pText.length &&
        hl.startOffset < hl.endOffset &&
        pText.slice(hl.startOffset, hl.endOffset) === hl.text
      ) {
        start = hl.startOffset;
        end = hl.endOffset;
      }
      // 2. Try wordOffset if available
      else if (typeof hl.wordOffset === 'number' && hl.wordOffset >= 0) {
        let currentWordIdx = 0;
        let wordFoundStart = -1;
        const wordRegex = /\S+/g;
        let match;
        while ((match = wordRegex.exec(pText)) !== null) {
          if (currentWordIdx === hl.wordOffset) {
            wordFoundStart = match.index;
            break;
          }
          currentWordIdx++;
        }

        if (
          wordFoundStart !== -1 &&
          pText.slice(wordFoundStart, wordFoundStart + hl.text.length) === hl.text
        ) {
          start = wordFoundStart;
          end = wordFoundStart + hl.text.length;
        } else {
          const searchStart = typeof hl.startOffset === 'number' ? Math.max(0, hl.startOffset - 20) : 0;
          const found = pText.indexOf(hl.text, searchStart);
          if (found !== -1) {
            start = found;
            end = found + hl.text.length;
          } else {
            const fallback = pText.indexOf(hl.text);
            if (fallback !== -1) {
              start = fallback;
              end = fallback + hl.text.length;
            }
          }
        }
      }
      // 3. Fallback for highlights without offsets
      else {
        const fallback = pText.indexOf(hl.text);
        if (fallback !== -1) {
          start = fallback;
          end = fallback + hl.text.length;
        }
      }

      if (start !== null && end !== null && start < end) {
        ranges.push({
          start,
          end,
          text: pText.slice(start, end),
          id: hl.id
        });
      }
    }

    if (ranges.length === 0) {
      return pText;
    }

    ranges.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    const merged: HighlightRange[] = [];
    for (const r of ranges) {
      if (merged.length === 0) {
        merged.push({ ...r });
      } else {
        const prev = merged[merged.length - 1];
        if (r.start < prev.end) {
          prev.end = Math.max(prev.end, r.end);
        } else {
          merged.push({ ...r });
        }
      }
    }

    const elements: React.ReactNode[] = [];
    let currentIndex = 0;

    merged.forEach((range, idx) => {
      if (range.start > currentIndex) {
        elements.push(pText.slice(currentIndex, range.start));
      }
      const highlightedSnippet = pText.slice(range.start, range.end);
      elements.push(
        <mark
          key={`vibe-hl-${pIndex}-${range.start}-${idx}`}
          data-highlight-id={range.id}
          className="vibe-hl"
          onClick={(e) => handleHighlightClick(e, highlightedSnippet, range.id)}
          title="Click to view meaning & synonyms"
        >
          {highlightedSnippet}
        </mark>
      );
      currentIndex = range.end;
    });

    if (currentIndex < pText.length) {
      elements.push(pText.slice(currentIndex));
    }

    return elements;
  };

  const handleResetFile = () => {
    setFileData(null);
    setWordPopover(null);
    localStorage.removeItem('vibe_current_file_v1');
  };

  return (
    <div className={`vibe-shell ${isLightMode ? 'vibe-theme-light' : 'vibe-theme-dark'}`}>
      <style>{`
        .vibe-shell {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          z-index: 9990;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          box-sizing: border-box;
          overflow: hidden;
          transition: background-color 0.2s ease, color 0.2s ease;
        }

        .vibe-theme-dark {
          background-color: #0B0B14;
          color: #F1F5F9;
        }

        .vibe-theme-light {
          background-color: #F8FAFC;
          color: #0F172A;
        }

        .vibe-progress-bar {
          position: fixed;
          top: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, #7C3AED 0%, #EC4899 100%);
          z-index: 10001;
          transition: width 0.1s ease-out;
        }

        .vibe-top-bar {
          position: sticky;
          top: 0;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          z-index: 10000;
          box-sizing: border-box;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .vibe-theme-dark .vibe-top-bar {
          background: rgba(11, 11, 20, 0.85);
          border-bottom-color: rgba(255, 255, 255, 0.08);
        }

        .vibe-theme-light .vibe-top-bar {
          background: rgba(255, 255, 255, 0.85);
          border-bottom-color: rgba(0, 0, 0, 0.08);
        }

        .vibe-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.08);
          color: inherit;
        }

        .vibe-theme-light .vibe-btn {
          border-color: rgba(0, 0, 0, 0.15);
          background: rgba(0, 0, 0, 0.05);
        }

        .vibe-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .vibe-theme-light .vibe-btn:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        .vibe-btn-highlight-on {
          background: linear-gradient(90deg, #7C3AED 0%, #EC4899 100%) !important;
          color: #FFFFFF !important;
          border-color: transparent !important;
          box-shadow: 0 0 14px rgba(236, 72, 153, 0.5);
        }

        .vibe-file-title {
          font-size: 14px;
          font-weight: 700;
          max-width: 320px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .vibe-content-scroll {
          flex: 1;
          overflow-y: auto;
          scroll-behavior: smooth;
          padding: 40px 20px 80px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }

        .vibe-article {
          width: 100%;
          max-width: 720px;
          box-sizing: border-box;
        }

        .vibe-para {
          font-size: 17.5px;
          line-height: 1.75;
          margin-bottom: 24px;
          word-break: break-word;
          transition: color 0.2s ease;
        }

        .vibe-theme-dark .vibe-para {
          color: #E2E8F0;
        }

        .vibe-theme-light .vibe-para {
          color: #1E293B;
        }

        .vibe-hl {
          background-color: #FEF08A;
          color: #1E293B;
          border-radius: 4px;
          padding: 1px 3px;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .vibe-hl:hover {
          background-color: #FDE047;
          box-shadow: 0 0 8px rgba(253, 224, 71, 0.6);
        }

        .vibe-popover {
          position: fixed;
          width: 330px;
          max-width: calc(100vw - 32px);
          z-index: 10005;
          background: #151522;
          color: #FFFFFF;
          border: 1px solid rgba(236, 72, 153, 0.4);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(124, 58, 237, 0.25);
          animation: vibe-popover-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
        }

        .vibe-theme-light .vibe-popover {
          background: #FFFFFF;
          color: #0F172A;
          border-color: rgba(236, 72, 153, 0.5);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18), 0 0 20px rgba(236, 72, 153, 0.2);
        }

        @keyframes vibe-popover-in {
          from { opacity: 0; transform: scale(0.95) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .vibe-popover-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .vibe-theme-light .vibe-popover-header {
          border-bottom-color: rgba(0, 0, 0, 0.08);
        }

        .vibe-popover-word {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.2px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .vibe-popover-tag {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 999px;
          background: rgba(124, 58, 237, 0.25);
          color: #C084FC;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .vibe-popover-phonetic {
          font-size: 12px;
          color: #94A3B8;
          font-family: ui-monospace, monospace;
        }

        .vibe-popover-close {
          background: transparent;
          border: none;
          color: #94A3B8;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .vibe-popover-close:hover {
          color: #FFFFFF;
          background: rgba(255, 255, 255, 0.1);
        }

        .vibe-theme-light .vibe-popover-close:hover {
          color: #0F172A;
          background: rgba(0, 0, 0, 0.08);
        }

        .vibe-popover-delete {
          background: transparent;
          border: none;
          color: #F87171;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .vibe-popover-delete:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #EF4444;
        }

        .vibe-theme-light .vibe-popover-delete:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .vibe-popover-def {
          font-size: 13.5px;
          line-height: 1.5;
          margin-bottom: 12px;
          color: #E2E8F0;
        }

        .vibe-theme-light .vibe-popover-def {
          color: #334155;
        }

        .vibe-synonyms-box {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed rgba(255, 255, 255, 0.1);
        }

        .vibe-theme-light .vibe-synonyms-box {
          border-top-color: rgba(0, 0, 0, 0.1);
        }

        .vibe-synonyms-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #EC4899;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .vibe-synonyms-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .vibe-synonym-pill {
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 12px;
          background: rgba(236, 72, 153, 0.12);
          border: 1px solid rgba(236, 72, 153, 0.35);
          color: #F472B6;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .vibe-theme-light .vibe-synonym-pill {
          background: rgba(236, 72, 153, 0.08);
          color: #DB2777;
        }

        .vibe-dropzone-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          box-sizing: border-box;
        }

        .vibe-dropzone {
          width: 100%;
          max-width: 480px;
          border: 2px dashed rgba(236, 72, 153, 0.5);
          border-radius: 20px;
          padding: 48px 24px;
          text-align: center;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.03);
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .vibe-dropzone:hover, .vibe-dropzone-active {
          border-color: #EC4899;
          background: rgba(236, 72, 153, 0.08);
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(236, 72, 153, 0.15);
        }

        .vibe-toast {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          background: #181826;
          color: #FFFFFF;
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 10px 20px;
          border-radius: 30px;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          z-index: 10002;
          pointer-events: none;
          display: flex;
          align-items: center;
          gap: 8px;
          animation: vibe-fade-in 0.2s ease;
        }

        @keyframes vibe-fade-in {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.docx,.txt"
        style={{ display: 'none' }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="vibe-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* WORD MEANING & SYNONYMS POPOVER */}
      {wordPopover && (
        <div
          ref={popoverRef}
          className="vibe-popover"
          style={{
            top: `${wordPopover.y}px`,
            left: `${wordPopover.x}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="vibe-popover-header">
            <div className="vibe-popover-word">
              <span>{wordPopover.word}</span>
              {wordPopover.partOfSpeech && (
                <span className="vibe-popover-tag">{wordPopover.partOfSpeech}</span>
              )}
              {wordPopover.phonetic && (
                <span className="vibe-popover-phonetic">{wordPopover.phonetic}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {wordPopover.highlightId && (
                <button
                  type="button"
                  className="vibe-popover-delete"
                  onClick={() => handleDeleteHighlight(wordPopover.highlightId!)}
                  title="Remove this highlight"
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              )}
              <button
                type="button"
                className="vibe-popover-close"
                onClick={() => setWordPopover(null)}
                title="Close"
              >
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>
          </div>

          {/* Definition */}
          {wordPopover.loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#EC4899' }}>
              <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Looking up definition & synonyms…</span>
            </div>
          ) : (
            <>
              <div className="vibe-popover-def">
                {wordPopover.definition}
              </div>

              {/* 2-3 Synonyms Popping out at side / bottom */}
              {wordPopover.synonyms && wordPopover.synonyms.length > 0 && (
                <div className="vibe-synonyms-box">
                  <div className="vibe-synonyms-label">
                    <Sparkles style={{ width: 13, height: 13 }} />
                    <span>Synonyms</span>
                  </div>
                  <div className="vibe-synonyms-list">
                    {wordPopover.synonyms.map((syn, idx) => (
                      <span key={`syn-${idx}`} className="vibe-synonym-pill">
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* VIEW STATE 1: DROPZONE / EMPTY STATE */}
      {!fileData ? (
        <div className="vibe-dropzone-container">
          {/* Back Button */}
          <button
            type="button"
            onClick={onBack}
            style={{
              position: "fixed",
              top: 16,
              left: 16,
              zIndex: 9999,
              background: "rgba(255,255,255,0.15)",
              color: "#FFFFFF",
              border: "1px solid rgba(255,255,255,0.4)",
              padding: "8px 14px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}
          >
            ← Back to Map
          </button>

          <div
            className={`vibe-dropzone ${isDragging ? 'vibe-dropzone-active' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Loader2 className="animate-spin" style={{ width: 36, height: 36, color: '#EC4899' }} />
                <span style={{ fontSize: 18, fontWeight: 700 }}>Vibing your file…</span>
              </div>
            ) : (
              <>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(236, 72, 153, 0.4)'
                  }}
                >
                  <UploadCloud style={{ width: 28, height: 28, color: '#FFFFFF' }} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>
                  Drop notes to vibe ⚡
                </div>
                <div style={{ fontSize: 13, opacity: 0.7, fontWeight: 600 }}>
                  PDF · DOCX · TXT
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* VIEW STATE 2: CLEAN READING VIEW */
        <>
          {/* Scroll progress bar */}
          <div className="vibe-progress-bar" style={{ width: `${scrollProgress}%` }} />

          {/* Sticky Top Reading Bar */}
          <header className="vibe-top-bar">
            {/* Left Zone: Back Button */}
            <button type="button" onClick={onBack} className="vibe-btn" title="Back to Map">
              <ArrowLeft style={{ width: 15, height: 15 }} />
              <span>Back</span>
            </button>

            {/* Middle: File Name */}
            <div className="vibe-file-title" title={fileData.fileName}>
              <Zap style={{ width: 14, height: 14, color: '#EC4899', flexShrink: 0 }} />
              <span>{fileData.fileName}</span>
            </div>

            {/* Right Zone: Highlighter Toggle & Theme Toggle & Open Another File */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Highlighter Toggle */}
              <button
                type="button"
                onClick={() => setIsHighlightMode((prev) => !prev)}
                className={`vibe-btn ${isHighlightMode ? 'vibe-btn-highlight-on' : ''}`}
                title={isHighlightMode ? 'Highlight mode is ON (select text)' : 'Turn highlight mode ON'}
              >
                <Highlighter style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 12 }}>{isHighlightMode ? 'Highlight ON' : 'Highlight'}</span>
              </button>

              {/* Light/Dark Toggle */}
              <button
                type="button"
                onClick={() => setIsLightMode((prev) => !prev)}
                className="vibe-btn"
                title={isLightMode ? 'Switch to Dark mode' : 'Switch to Light mode'}
              >
                {isLightMode ? <Moon style={{ width: 15, height: 15 }} /> : <Sun style={{ width: 15, height: 15 }} />}
              </button>

              {/* Open new file */}
              <button
                type="button"
                onClick={handleResetFile}
                className="vibe-btn"
                title="Open a different document"
              >
                <UploadCloud style={{ width: 15, height: 15 }} />
              </button>
            </div>
          </header>

          {/* Content Container */}
          <div
            ref={scrollContainerRef}
            className="vibe-content-scroll"
            onScroll={handleScroll}
            onMouseUp={handleSelectionRelease}
            onTouchEnd={handleSelectionRelease}
            onClick={() => setWordPopover(null)}
          >
            <article className="vibe-article">
              {fileData.paragraphs.map((paraText, pIdx) => (
                <p key={`para-${pIdx}`} data-vibe-para-index={pIdx} className="vibe-para">
                  {renderParagraphContent(paraText, pIdx)}
                </p>
              ))}
            </article>
          </div>
        </>
      )}
    </div>
  );
}

