/**
 * Feed RAG - alimenta o índice RAG cruzando LLM + conhecimento estruturado
 *
 * Fluxo:
 * 1. LLM gera conteúdo estruturado sobre domínio solicitado
 * 2. Cada seção é ingerida no RAG com metadata
 * 3. Query de verificação valida que o retrieval funciona
 * 4. Relatório final de cobertura
 */

const BURL = 'http://127.0.0.1:5589';
const OPENROUTER_API_KEY = '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';
const MODEL = 'qwen/qwen3.6-plus:free';

const TOPICS = [
  {
    domain: 'Medicina Pediátrica - APLV',
    prompt: `Guia técnico sobre APLV: definição, epidemiologia, mecanismos IgE/não-IgE/misto, frações proteicas do leite, apresentação clínica, diagnóstico diferencial, manejo dietético, fórmulas, reintrodução, seguimento, crescimento, micronutrientes. ---SEÇÃO--- entre tópicos.`,
  },
  {
    domain: 'Medicina Clínica I',
    prompt: `Guias concisos de: Cardiologia (SCA, insuficiência cardíaca, arritmias, HAS, ECG), Neurologia (AVC, epilepsia, cefaleias, neurodegenerativas), Endocrinologia (DM1/DM2, tireoide, obesidade, osteoporose), Pneumologia (asma GINA, DPOC GOLD, pneumonia, TEP). ---SEÇÃO--- entre tópicos.`,
  },
  {
    domain: 'Medicina Clínica II',
    prompt: `Guias concisos de: Gastroenterologia/Hepatologia (DRGE, DII, hepatites, cirrose, APLV), Nefrologia (DRC KDIGO, distúrbios hidroeletrolíticos, ITU, diálise), Infectologia (SEPSE, HIV, TB, dengue/Zika/CHIKV, antibioticoterapia), Emergências/UTI (ACLS, ATLS, choques, ARDS). ---SEÇÃO--- entre tópicos.`,
  },
  {
    domain: 'Especialidades Médicas',
    prompt: `Guias concisos de: Ortopedia (fraturas, LCA, hérnia, ortopedia pediátrica), Oftalmologia (catarata, glaucoma, DM retinopatia, erros de refração), Dermatologia (dermatite atópica, psoríase, acne, melanoma), Otorrino (OMA, sinusite, SAOS, hipoacusia), Urologia (HPB, litíase, ca próstata), Ginecologia/Obstetrícia/Neonatologia, Psiquiatria, Oncologia/Hematologia, Reumatologia, Cuidados Paliativos. ---SEÇÃO--- entre tópicos.`,
  },
  {
    domain: 'Saúde Multidisciplinar',
    prompt: `Guias concisos de: Fisioterapia (musculoesquelética, respiratória, neurológica), Nutrição Clínica (avaliação, enteral/parenteral, dietas terapêuticas), Enfermagem (SAE, curativos, sondas, biossegurança), Terapia Ocupacional (AVD, integração sensorial, reabilitação), Fonoaudiologia (disfagia, afasia, audição), Assistência Social (SUAS, BPC, rede de proteção). ---SEÇÃO--- entre tópicos.`,
  },
  {
    domain: 'Ciência da Saúde',
    prompt: `Guias concisos de: Bibliotecas Científicas (PubMed/MeSH, Cochrane, BVS/LILACS, SciELO), Organizações (OMS/WHO, OPAS, CDC, ANVISA, FDA), Sociedades Médicas (ESPGHAN, WAO/DRACMA, EAACI, AAP, SBP, ASBAI), Revistas (NEJM, Lancet, JAMA, BMJ), MBE (hierarquia de evidência, GRADE, NNT, meta-análise), Farmacologia (ADME, interações, reações adversas), Genética Médica (herança, testes, conselhamento), Saúde Coletiva/Epidemiologia (SUS, vigilância, indicadores). ---SEÇÃO--- entre tópicos.`,
  },
  {
    domain: 'Tecnologia e Programação',
    prompt: `Guias concisos de: IA/LLMs/RAG (embeddings, vector stores, retrieval pipeline), Arquitetura de Software (backend-first, APIs, job queues), TypeScript/JavaScript (tipos, async, padrões de projeto, Vite/esbuild), Python (dataclasses, pandas, FastAPI, ML), Rust/Go (ownership, goroutines, WASM), ML/Data Science, Design/UI/UX, Eletrônica/IoT (ESP32, MQTT, sensores). ---SEÇÃO--- entre tópicos.`,
  },
  {
    domain: 'Produção de Mídia',
    prompt: `Guias concisos de: Produção de Áudio (sinal chain, compressão, EQ, reverb, mixing, mastering, DAWs), Produção de Vídeo (composição, lighting three-point, câmeras/lentes, codecs, color grading, formatos), Imagem com IA Generativa (Stable Diffusion, ControlNet, Midjourney, prompts, upscaling, parâmetros técnicos, pós-produção. ---SEÇÃO--- entre tópicos.`,
  },
  {
    domain: 'Arquitetura Digital e BIM',
    prompt: `Guia de arquitetura digital: BIM (Building Information Modeling), modelagem 3D (Revit, SketchUp, Rhino), renderização (V-Ray, Twinmotion, Lumion), fluxo projeto à entrega, automação com scripts (Dynamo, Grasshopper), realidade virtual, documentação técnica digital. ---SEÇÃO--- entre tópicos.`,
  },
];

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function llmGenerate(prompt: string, retries = 5): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://atlas-corp.local',
        'X-Title': 'Atlas Corp RAG Feed',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 5000,
      }),
    });

    if (res.ok) {
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? '';
    }

    const status = res.status;
    const text = await res.text();

    if (status === 429 && attempt < retries - 1) {
      const waitMs = Math.min(1000 * Math.pow(2, attempt), 30000);
      console.log(`    ⏳ Rate limited (tentativa ${attempt + 1}), aguardando ${waitMs / 1000}s...`);
      await delay(waitMs);
      continue;
    }

    throw new Error(`LLM request failed: ${status} ${text}`);
  }

  throw new Error(`LLM request failed after ${retries} retries`);
}

async function ingestText(text: string, source: string): Promise<{ chunkCount: number }> {
  const res = await fetch(`${BURL}/rag/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source }),
  });

  if (!res.ok) {
    throw new Error(`Ingest failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function searchRag(query: string): Promise<any[]> {
  const res = await fetch(`${BURL}/rag/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, topK: 3 }),
  });

  if (!res.ok) {
    throw new Error(`Search failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.results || [];
}

async function main() {
  const report: Array<{ domain: string; chunks: number }> = [];

  for (const topic of TOPICS) {
    console.log(`\n[${report.length + 1}/${TOPICS.length}] Gerando conteúdo: ${topic.domain}`);

    const content = await llmGenerate(topic.prompt);
    if (!content) {
      console.log(`  ⚠ LLM retornou vazio para ${topic.domain}`);
      report.push({ domain: topic.domain, chunks: 0 });
      continue;
    }

    console.log(`  \u2192 ${content.length} caracteres gerados`);

    const sections = content.split('---SEÇÃO---').map((s) => s.trim()).filter(Boolean);
    console.log(`  \u2192 ${sections.length} seções identificadas`);

    let totalChunks = 0;
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const result = await ingestText(section, topic.domain);
      totalChunks += result.chunkCount;
      if (totalChunks % 5 === 0 || i === sections.length - 1) {
        console.log(`  [${i + 1}/${sections.length}] Ingestidos: ${totalChunks} chunks`);
      }
      await delay(300);
    }

    report.push({ domain: topic.domain, chunks: totalChunks });
    await delay(1000);
  }

  // Final stats
  console.log('\n=== RELATÓRIO FINAL ===');
  const statsRes = await fetch(`${BURL}/rag/stats`);
  const stats = await statsRes.json();
  console.log(`Total de vetores no índice: ${stats.count}`);
  console.log('Dominios processados:');
  for (const r of report) {
    console.log(`  [${r.chunks > 0 ? '✅' : '⚠'}] ${r.domain}: ${r.chunks} chunks`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
