import { describe, it, expect } from 'vitest';
import { chunkText } from './rag-index';

describe('chunkText', () => {
  it('chunks a short paragraph as a single chunk', () => {
    const text = 'This is a short paragraph that should fit in one chunk without splitting.';
    const chunks = chunkText(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain('This is a short paragraph');
  });

  it('splits by paragraphs first', () => {
    const text = 'Paragraph one with some words here.\n\nParagraph two with some words here.';
    const chunks = chunkText(text);
    expect(chunks.length).toBe(2);
  });

  it('includes metadata with source index', () => {
    const chunks = chunkText('Hello world');
    expect(chunks[0].metadata.index).toBe(0);
  });

  it('splits long text with multiple paragraphs into multiple chunks', () => {
    // Use paragraph-separated text
    const paragraphs = Array(10).fill('This is a test paragraph with enough words to make sense and exceed the maximum token limit when combined together with other similar paragraphs in the text body that needs to be processed and analyzed by the system for relevance and content quality assessment purposes').join('\n\n');
    const chunks = chunkText(paragraphs);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('splits paragraphs with many sentences at sentence boundaries', () => {
    // A single "paragraph" with many sentences should be sub-chunked
    const sentences = Array(50).fill('This is an important sentence to consider for the analysis').join('. ');
    const chunks = chunkText(sentences, { maxTokens: 30 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});
