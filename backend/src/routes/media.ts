import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { MediaType } from '../lib/av-constants';
import { router } from '../lib/llm/router';
import { AllProvidersFailedError, ProviderError } from '../lib/llm/errors';

// Patch-style schema
const MediaBody = z.object({
  prompt: z.string().trim().min(1, 'prompt is required'),
  type: z.enum(['video', 'audio', 'image', 'social', 'text', 'podcast', 'code', 'summary', 'structured'] as const).default('text'),
  provider: z.string().optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(8192).optional(),
  schema: z.string().optional(),
  style: z.string().trim().optional(),
  duration: z.string().trim().optional(),
  format: z.string().trim().optional(),
  platform: z.string().trim().optional(),
  language: z.string().trim().optional(),
  tone: z.string().trim().optional(),
  targetAudience: z.string().trim().optional(),
});

export async function registerMediaRoutes(app: FastifyInstance) {
  app.post('/media/generate', async (request, reply) => {
    const parse = MediaBody.safeParse(request.body ?? {});
    if (!parse.success) {
      reply.code(400);
      return { error: 'invalid_request', issues: parse.error.flatten() };
    }

    const input = parse.data;
    const { type, prompt, style, duration, format, platform, language, tone, targetAudience, systemPrompt, schema, temperature, maxTokens, model } = input;

    const system =
      systemPrompt ??
      (schema
        ? `You are a data extraction assistant. Respond ONLY with valid JSON matching the requested schema.\n\nExpected schema:\n${schema}`
        : buildSystemPrompt(type, { style, duration, format, platform, language, tone, targetAudience }));

    const messages = [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: prompt },
    ];

    let result;
    try {
      result = await router.chat({ messages, model, temperature, maxTokens }, input.provider);
    } catch (err: unknown) {
      if (err instanceof AllProvidersFailedError) {
        return reply.status(503).send({ error: 'all_providers_failed', message: err.message, details: err.details });
      }
      if (err instanceof ProviderError) {
        return reply.status(502).send({ error: 'provider_error', provider: err.provider, message: err.message });
      }
      return reply.status(500).send({ error: 'internal_error', message: String(err) });
    }

    // For structured, try to parse JSON
    let parsed: unknown = null;
    if (type === 'structured') {
      try {
        const cleaned = result.content.replace(/```(?:json)?\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        // Not valid JSON, return as-is
      }
    }

    return reply.send({
      content: result.content,
      parsed,
      id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mediaType: type,
      prompt,
      createdAt: new Date().toISOString(),
      meta: {
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        type,
      },
    });
  });
}

function buildSystemPrompt(type: string, opts: {
  style?: string; duration?: string; format?: string;
  platform?: string; language?: string; tone?: string; targetAudience?: string;
}): string {
  const mediaDescriptions: Record<MediaType, string> = {
    video: 'gere um roteiro completo de vídeo, incluindo storyboard, planos de filmagem e pós-produção',
    audio: 'gere um guia completo de produção musical, incluindo estrutura, instrumentação e mixagem',
    image: 'gere prompts detalhados para geração de imagens, incluindo composição, iluminação e câmera',
    social: 'gere conteúdo para redes sociais, adaptado à plataforma e público-alvo',
    text: 'gere um texto estruturado e profissional, com clareza e profundidade',
    podcast: 'gere um plano completo de podcast, incluindo segmentos, edição e entrega',
  };
  const lines = [
    'Você é o Atlas, especialista em produção midiática.',
    `Sua tarefa: ${(mediaDescriptions as Record<string, string>)[type] || 'gere conteúdo midiático estruturado'}.`,
  ];
  if (opts.style) lines.push(`Estilo: ${opts.style}`);
  if (opts.duration) lines.push(`Duração: ${opts.duration}`);
  if (opts.format) lines.push(`Formato: ${opts.format}`);
  if (opts.platform) lines.push(`Plataforma: ${opts.platform}`);
  if (opts.language) lines.push(`Idioma: ${opts.language}`);
  if (opts.tone) lines.push(`Tom: ${opts.tone}`);
  if (opts.targetAudience) lines.push(`Público-alvo: ${opts.targetAudience}`);
  lines.push('Responda de forma estruturada, clara e profissional.');
  return lines.join('\n');
}
