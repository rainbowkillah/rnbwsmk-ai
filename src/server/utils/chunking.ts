/**
 * Text Chunking Utilities
 * Breaks down large documents into semantically meaningful chunks
 * Phase 4: Vectorize Setup
 */

export interface ChunkOptions {
  maxChunkSize?: number;        // Maximum characters per chunk
  overlapSize?: number;          // Overlap between chunks for context
  splitOn?: 'paragraph' | 'sentence' | 'token';
  preserveStructure?: boolean;   // Keep markdown headers, lists, etc.
}

export interface TextChunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
  metadata?: Record<string, any>;
}

/**
 * Chunk text into smaller pieces with optional overlap
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const {
    maxChunkSize = 1000,
    overlapSize = 200,
    splitOn = 'paragraph',
    preserveStructure = true
  } = options;

  // Normalize whitespace
  const normalizedText = text.replace(/\r\n/g, '\n').trim();

  if (normalizedText.length <= maxChunkSize) {
    // Text is small enough, return as single chunk
    return [{
      text: normalizedText,
      index: 0,
      startChar: 0,
      endChar: normalizedText.length
    }];
  }

  let chunks: TextChunk[];

  switch (splitOn) {
    case 'paragraph':
      chunks = chunkByParagraph(normalizedText, maxChunkSize, overlapSize);
      break;
    case 'sentence':
      chunks = chunkBySentence(normalizedText, maxChunkSize, overlapSize);
      break;
    case 'token':
      chunks = chunkByCharacter(normalizedText, maxChunkSize, overlapSize);
      break;
    default:
      chunks = chunkByParagraph(normalizedText, maxChunkSize, overlapSize);
  }

  return chunks;
}

/**
 * Chunk by paragraphs (best for general text)
 */
function chunkByParagraph(
  text: string,
  maxSize: number,
  overlap: number
): TextChunk[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let currentStart = 0;
  let chunkIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    if (!paragraph) continue;

    const potentialChunk = currentChunk
      ? currentChunk + '\n\n' + paragraph
      : paragraph;

    if (potentialChunk.length <= maxSize) {
      currentChunk = potentialChunk;
    } else {
      // Current chunk is full, save it
      if (currentChunk) {
        chunks.push({
          text: currentChunk,
          index: chunkIndex++,
          startChar: currentStart,
          endChar: currentStart + currentChunk.length
        });

        // Start new chunk with overlap
        const overlapText = getOverlapText(currentChunk, overlap);
        currentChunk = overlapText ? overlapText + '\n\n' + paragraph : paragraph;
        currentStart = currentStart + currentChunk.length - overlapText.length;
      } else {
        // Single paragraph is larger than maxSize, split it
        const sentenceChunks = chunkBySentence(paragraph, maxSize, overlap);
        sentenceChunks.forEach(chunk => {
          chunks.push({
            ...chunk,
            index: chunkIndex++,
            startChar: currentStart + chunk.startChar,
            endChar: currentStart + chunk.endChar
          });
        });
        currentChunk = '';
        currentStart = currentStart + paragraph.length;
      }
    }
  }

  // Add final chunk
  if (currentChunk) {
    chunks.push({
      text: currentChunk,
      index: chunkIndex,
      startChar: currentStart,
      endChar: currentStart + currentChunk.length
    });
  }

  return chunks;
}

/**
 * Chunk by sentences (good for precise Q&A)
 */
function chunkBySentence(
  text: string,
  maxSize: number,
  overlap: number
): TextChunk[] {
  // Split on sentence boundaries
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let currentStart = 0;
  let chunkIndex = 0;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    const potentialChunk = currentChunk
      ? currentChunk + ' ' + trimmedSentence
      : trimmedSentence;

    if (potentialChunk.length <= maxSize) {
      currentChunk = potentialChunk;
    } else {
      // Save current chunk
      if (currentChunk) {
        chunks.push({
          text: currentChunk,
          index: chunkIndex++,
          startChar: currentStart,
          endChar: currentStart + currentChunk.length
        });

        // Start new chunk with overlap
        const overlapText = getOverlapText(currentChunk, overlap);
        currentChunk = overlapText ? overlapText + ' ' + trimmedSentence : trimmedSentence;
        currentStart = currentStart + currentChunk.length - overlapText.length;
      } else {
        // Single sentence is too long, split by character
        const charChunks = chunkByCharacter(trimmedSentence, maxSize, overlap);
        charChunks.forEach(chunk => {
          chunks.push({
            ...chunk,
            index: chunkIndex++,
            startChar: currentStart + chunk.startChar,
            endChar: currentStart + chunk.endChar
          });
        });
        currentStart = currentStart + trimmedSentence.length;
      }
    }
  }

  // Add final chunk
  if (currentChunk) {
    chunks.push({
      text: currentChunk,
      index: chunkIndex,
      startChar: currentStart,
      endChar: currentStart + currentChunk.length
    });
  }

  return chunks;
}

/**
 * Chunk by character count (fallback for unstructured text)
 */
function chunkByCharacter(
  text: string,
  maxSize: number,
  overlap: number
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let index = 0;
  let start = 0;

  while (start < text.length) {
    let end = start + maxSize;

    // If not at the end, try to break at a word boundary
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start) {
        end = lastSpace;
      }
    } else {
      end = text.length;
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText) {
      chunks.push({
        text: chunkText,
        index: index++,
        startChar: start,
        endChar: end
      });
    }

    // Move start forward, accounting for overlap
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
}

/**
 * Get last N characters for overlap, breaking at word boundary
 */
function getOverlapText(text: string, overlapSize: number): string {
  if (overlapSize === 0 || text.length <= overlapSize) {
    return '';
  }

  const overlapStart = text.length - overlapSize;
  const firstSpace = text.indexOf(' ', overlapStart);

  if (firstSpace === -1) {
    return text.slice(overlapStart);
  }

  return text.slice(firstSpace + 1);
}

/**
 * Chunk markdown while preserving structure
 */
export function chunkMarkdown(
  markdown: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const { maxChunkSize = 1000, overlapSize = 200 } = options;

  // Split by headers first
  const sections = markdown.split(/^(#{1,6}\s+.+)$/gm);
  const chunks: TextChunk[] = [];
  let currentHeader = '';
  let currentContent = '';
  let chunkIndex = 0;
  let charPosition = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    // Check if this is a header
    if (/^#{1,6}\s+/.test(section)) {
      // Save previous section if exists
      if (currentContent) {
        const sectionText = currentHeader + '\n\n' + currentContent;
        if (sectionText.length <= maxChunkSize) {
          chunks.push({
            text: sectionText.trim(),
            index: chunkIndex++,
            startChar: charPosition,
            endChar: charPosition + sectionText.length,
            metadata: { header: currentHeader }
          });
          charPosition += sectionText.length;
        } else {
          // Section too large, chunk it
          const subChunks = chunkText(currentContent, { maxChunkSize, overlapSize });
          subChunks.forEach(chunk => {
            chunks.push({
              text: currentHeader + '\n\n' + chunk.text,
              index: chunkIndex++,
              startChar: charPosition + chunk.startChar,
              endChar: charPosition + chunk.endChar,
              metadata: { header: currentHeader }
            });
          });
          charPosition += currentContent.length;
        }
      }

      currentHeader = section;
      currentContent = '';
    } else {
      currentContent += (currentContent ? '\n\n' : '') + section;
    }
  }

  // Add final section
  if (currentContent) {
    const sectionText = currentHeader + '\n\n' + currentContent;
    chunks.push({
      text: sectionText.trim(),
      index: chunkIndex,
      startChar: charPosition,
      endChar: charPosition + sectionText.length,
      metadata: { header: currentHeader }
    });
  }

  return chunks;
}

/**
 * Chunk HTML while stripping tags but preserving structure
 */
export function chunkHTML(
  html: string,
  options: ChunkOptions = {}
): TextChunk[] {
  // Strip HTML tags but preserve structure
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return chunkText(text, options);
}

/**
 * Smart chunking that detects format and applies appropriate strategy
 */
export function smartChunk(
  content: string,
  options: ChunkOptions = {}
): TextChunk[] {
  // Detect format
  if (content.includes('```') || /^#{1,6}\s+/m.test(content)) {
    // Looks like markdown
    return chunkMarkdown(content, options);
  } else if (/<[^>]+>/.test(content)) {
    // Looks like HTML
    return chunkHTML(content, options);
  } else {
    // Plain text
    return chunkText(content, options);
  }
}
