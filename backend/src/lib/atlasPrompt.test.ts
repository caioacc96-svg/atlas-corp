import { describe, it, expect } from 'vitest';
import { atlasSystemPrompt } from './atlasPrompt';

describe('Atlas System Prompt', () => {
  it('is a non-empty string', () => {
    expect(typeof atlasSystemPrompt).toBe('string');
    expect(atlasSystemPrompt.length).toBeGreaterThan(100);
  });

  it('contains identity directives', () => {
    expect(atlasSystemPrompt).toContain('Atlas');
    expect(atlasSystemPrompt).toContain('sóbrio');
    expect(atlasSystemPrompt).toContain('útil');
  });

  it('contains behavioral guidelines', () => {
    expect(atlasSystemPrompt).toContain('Comportamento esperado');
    expect(atlasSystemPrompt).toContain('Lei soberana');
  });

  it('warns against overengineering', () => {
    expect(atlasSystemPrompt).toContain('overengineering');
  });
});
