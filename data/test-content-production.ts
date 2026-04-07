/**
 * Atlas Content Production — Teste completo de geração de conteúdo
 *
 * Gera conteúdo real para: YouTube, Instagram, Reels, Áudio, Vídeo, Imagem AI, Texto
 */

const API_KEY = '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';
const MODEL = 'qwen/qwen3.6-plus:free';

const TESTS = [
  {
    tipo: 'YouTube — Roteiro técnico',
    prompt: `Gere um roteiro de vídeo YouTube (8-10 min) sobre "Como funciona a Alergia à Proteína do Leite de Vaca (APLV)".
Formato:
- Hook (0-15s): frase impactante
- Intro (15-45s): contexto do problema
- Corpo (3 blocos): mecanismo, diagnóstico, manejo
- CTA (15s): chamada para ação
Include timestamps e falas prontas para narração.`,
  },
  {
    tipo: 'Instagram — Carrossel educativo',
    prompt: `Gere um carrossel de 8 slides para Instagram sobre "5 sinais que seu bebê pode ter APLV".
Formato por slide:
- Slide 1: Cover (título chamativo)
- Slides 2-6: 1 sinal por slide (texto curto, direto, máximo 15 palavras)
- Slide 7: Resumo prático
- Slide 8: CTA + "Salve este post"
- Inclua legenda do post com hashtags relevantes`,
  },
  {
    tipo: 'Reels/TikTok — Roteiro curto',
    prompt: `Gere 3 roteiros de Reels/TikTok (15-30s cada) sobre saúde infantil:
1) "O que é APLV em 30 segundos"
2) "3 erros que os pais cometem na introdução alimentar"
3) "Sinal silencioso de alergia que ninguém percebe"
Formato: hook visual + texto falado + CTA. Linguagem acessível, ritmo rápido.`,
  },
  {
    tipo: 'Produção de Imagem AI — Prompts',
    prompt: `Gere 5 prompts detalhados para geração de imagens com IA (Stable Diffusion/Midjourney) para posts infantis pediátricos:
Cada prompt deve incluir: subject, style, lighting, composition, camera angle, negative prompt, CFG scale, steps.
Temas: consulta pediátrica, bebê saudável, alimentação infantil, vacinação, maternidade.`,
  },
  {
    tipo: 'Produção de Áudio — Trilha sonora',
    prompt: `Gere um guia de produção de trilha sonora para vídeos educacionais pediátricos:
- BPM ideal e estilo (lo-fi, ambient, instrumental suave)
- Instrumentação (pads, piano, strings)
- Estrutura por seção (intro, body, CTA, outro)
- Dicas de mixing para não competir com a voz
- Referência de artistas similares`,
  },
  {
    tipo: 'Produção de Vídeo — Captação e Edição',
    prompt: `Gere um guia de produção de vídeo educacional médico:
- Equipamento mínimo (câmera, lente, microfone, luz)
- Configurações da câmera (frame rate, shutter, ISO, resolução)
- Esquema de iluminação 3 pontos para consultório/estúdio
- Edição: workflow (seleção → rough cut → color → audio → export)
- Formatos de export para YouTube, Instagram, Reels`,
  },
  {
    tipo: 'Texto longo — Artigo de blog',
    prompt: `Gere um artigo de blog de ~800 palavras sobre "Guia prático para pais sobre APLV: do diagnóstico ao manejo diário".
Estrutura: título atraente, introdução com problema, 5 seções com subtítulos, conclusão prática, FAQ com 3 perguntas.
Tom: informativo, acessível, baseado em evidência, sem sensacionalismo.`,
  },
  {
    tipo: 'Newsletter — Email marketing',
    prompt: `Gere uma newsletter para pais sobre saúde infantil com o tema "Alimentação nos primeiros 2 anos".
- Subject line: 3 opções para A/B test
- Preheader: texto curto
- Corpo: intro pessoal, 3 blocos com dicas práticas, CTA suave
- Tom: profissional mas acolhedor, sem medicalizar demais`,
  },
  {
    tipo: 'Conteúdo LinkedIn — Profissional',
    prompt: `Gere um post profissional de LinkedIn sobre o futuro da IA na medicina.
- Hook: dado surpreendente ou provocação
- Corpo: 3 pontos sobre como IA está mudando a prática clínica
- Conclusão: reflexão sobre o equilíbrio entre tecnologia e humanização
- Hashtags relevantes
Tom:Thought leadership, sóbrio, sem hype.`,
  },
  {
    tipo: 'Prompt de Imagem — Infográfico',
    prompt: `Gere prompts para IA gerar infográficos vetoriais limpos:
1) Infográfico: "Pirâmide de evidência da MBE" (estilo flat, cores suaves, hierarquia visual)
2) Infográfico: "Algoritmo diagnóstico da APLV" (flowchart limpo, ícones médicos, cores institucionais)
3) Infográfico: "Escada terapêutica da APLV" (de AM → exclusão materna → FEH → FAA → AAF)
Inclua style, layout, cores e referências visuais.`,
  },
];

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function llmGenerate(prompt: string, retries = 5): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const waitMs = [0, 2000, 5000, 15000, 30000][attempt] || 30000;
    if (waitMs > 0) {
      console.log(`    ⏳ Retry ${attempt + 1}, aguardando ${waitMs / 1000}s...`);
      await delay(waitMs);
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
          'HTTP-Referer': 'https://atlas-corp.local',
          'X-Title': 'Atlas Corp Content Production',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      });

      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        return data.choices?.[0]?.message?.content ?? '';
      }

      if (res.status === 429) continue;
      const text = await res.text();
      throw new Error(`LLM: ${res.status} ${text}`);
    } catch (err) {
      if (attempt === retries - 1) throw err;
    }
  }
  return '';
}

export function extractPreview(text: string, maxLength: number = 300): string {
  const clean = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '').replace(/#/g, '').trim();
  return clean.length > maxLength ? clean.slice(0, maxLength).trim() + '...' : clean;
}

export async function generateContent(tipo: string, prompt: string): Promise<string> {
  const result = await llmGenerate(prompt);
  if (!result) throw new Error(`Conteúdo vazio para ${tipo}`);
  console.log(`   📝 ${tipo}: ${result.length} caracteres gerados`);
  return result;
}

export async function ingestContent(tipo: string, content: string): Promise<number> {
  try {
    const res = await fetch('http://127.0.0.1:5589/rag/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content, source: `production-${tipo}` }),
    });
    if (!res.ok) return 0;
    const json = await res.json();
    return json.chunkCount || 0;
  } catch {
    return 0;
  }
}

export async function searchContent(query: string): Promise<any[]> {
  try {
    const res = await fetch('http://127.0.0.1:5589/rag/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK: 3 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

export async function main(): Promise<void> {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('   ATLAS CONTENT PRODUCTION — TESTE NÍVEL ATLAS');
  console.log(`   ${TESTS.length} tipos de conteúdo para gerar`);
  console.log('══════════════════════════════════════════════════════\n');

  let successCount = 0;
  let failedCount = 0;
  let totalChunks = 0;

  for (const test of TESTS) {
    try {
      console.log(`[GERANDO] ${test.tipo}`);

      // 1. Gerar conteúdo
      const content = await generateContent(test.tipo, test.prompt);

      if (!content) {
        console.log(`   ❌ Conteúdo vazio\n`);
        failedCount++;
        continue;
      }

      // 2. Mostrar preview
      const preview = extractPreview(content, 200);
      console.log(`   Preview: ${preview}\n`);

      successCount++;

      // 3. Ingester no RAG para memória futura
      const chunks = await ingestContent(test.tipo, content);
      totalChunks += chunks;

      await delay(2000);

    } catch (err) {
      console.log(`   ❌ Falha: ${err instanceof Error ? err.message : String(err)}\n`);
      failedCount++;
    }
  }

  // Final stats
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   RESULTADO FINAL');
  console.log(`   Conteúdo gerado: ${successCount}/${TESTS.length}`);
  console.log(`   Chunks adicionados ao RAG: ${totalChunks}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test search
  console.log('   TESTE DE BUSCA NO CONTEÚDO GERADO');
  const searchResults = await searchContent('como produzir conteúdo para Instagram');
  console.log(`   Found: ${searchResults.length} results`);
  for (const hit of searchResults) {
    const preview = hit.text?.slice(0, 100);
    if (preview) {
      console.log(`   [${hit.score.toFixed(3)}] ${preview}`);
    }
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
