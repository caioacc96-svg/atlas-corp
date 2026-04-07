/**
 * Feed RAG Extended - alimenta o índice RAG com 30 domínios em background
 */

const BURL = 'http://127.0.0.1:5589';
const API_KEY = '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';
const MODEL = 'qwen/qwen3.6-plus:free';

const TOPICS = [
  { domain: 'Cardiologia Clínica', prompt: 'Guia conciso de Cardiologia: SCA (IAMCSST, AI/SCAA), insuficiência cardíaca NYHA, arritmias (FA, taquicardias, bloqueios), HAS (classificação, alvos, fármacos), valvopatias, ECG (eixos, ondas, padrões patológicos), ecocardiografia. Separe com ---SEÇÃO---.' },
  { domain: 'Neurologia', prompt: 'Guia conciso de Neurologia: AVC isquêmico/hemorrágico, epilepsias ILAE, cefaleias (enxaqueca, tensional), neuropatias, Alzheimer, Parkinson, ADEM pediátrico, EEG/RM. Separe com ---SEÇÃO---.' },
  { domain: 'Endocrinologia', prompt: 'Guia conciso de Endocrinologia: DM1/DM2 (insulinas, OADs, SGLT2, GLP-1), tireoidopatias (Hashimoto, Graves), obesidade (fármacos, cirurgia), osteoporose, dislipidemias, eixo adrenal. Separe com ---SEÇÃO---.' },
  { domain: 'Gastroenterologia e Hepatologia', prompt: 'Guia conciso de Gastro/Hepato: DRGE, DII (Crohn, RCU), hepatites A/B/C, cirrose, pancreatite, SII Roma IV, APLV, endoscopia. Separe com ---SEÇÃO---.' },
  { domain: 'Infectologia', prompt: 'Guia conciso de Infectologia: SEPSIS (qSOFA, SOFA, SSC), HIV (TARV, CD4), TB (diagnóstico, manejo), dengue/Zika/ChikV, antibioticoterapia, profilaxias. Separe com ---SEÇÃO---.' },
  { domain: 'Emergências e UTI', prompt: 'Guia conciso de Emerg/UTI: ACLS, ATLS, choques, emergência hipertensiva, insuficiência respiratória (ARDS, VM), sepse grave, IRA KDIGO, distúrbios ácido-base. Separe com ---SEÇÃO---.' },
  { domain: 'Psiquiatria', prompt: 'Guia conciso de Psiquiatria: depressão DSM-5 (ISRS, TCC), T. ansiedade, t. pânico, TEA, TOC, TEPT, bipolar, esquizofrenia, TDAH, suicídio (riscos, abordagem). Separe com ---SEÇÃO---.' },
  { domain: 'Oncologia e Hematologia', prompt: 'Guia conciso de Onco/Hemato: neoplasias (TNM, quimio, imuno), leucemias/linfomas, anemias (ferropriva, falcêmica, megaloblástica), coagulopatias (hemofilia, DIC), mielograma. Separe com ---SEÇÃO---.' },
  { domain: 'Dermatologia', prompt: 'Guia conciso de Dermatologia: dermatite atópica, psoríase, acne, melanoma (ABCDE), neoplasias cutâneas, infecções dermatológicas, urticária, dermatoscopia, queimaduras. Separe com ---SEÇÃO---.' },
  { domain: 'Pneumologia', prompt: 'Guia conciso de Pneumo: asma GINA, DPOC GOLD, pneumonia (etiologia, escores, abx), TEP (diagnóstico, anticoagulação), insuficiência respiratória, ventilação mecânica, espirometria. Separe com ---SEÇÃO---.' },
  { domain: 'Ginecologia e Obstetrícia', prompt: 'Guia conciso de Ginec/Obstet: pré-natal, pré-eclâmpsia, diabetes gestacional, parto, puerpério, métodos contraceptivos, ISTs, SOP, endometriose, oncologia ginecológica, neonatologia (APGAR, icterícia). Separe com ---SEÇÃO---.' },
  { domain: 'Nefrologia', prompt: 'Guia conciso de Nefro: DRC KDIGO, síndrome nefrótica, glomerulonefrites, distúrbios hidroeletrolíticos, ITU, hemodiálise, diálise peritoneal, transplante renal. Separe com ---SEÇÃO---.' },
  { domain: 'Ortopedia e Traumatologia', prompt: 'Guia conciso de Ortop: fraturas AO, LCA, hérnia de disco, osteoartrite, ortopedia pediátrica (galho verde, pé torto, displasia), artroscopia, reabilitação. Separe com ---SEÇÃO---.' },
  { domain: 'Oftalmologia', prompt: 'Guia conciso de Oftalmologia: catarata (IOL), glaucoma, DM retinopatia (anti-VEGF), estrabismo, erros de refração, uveítes, ceratocone, tonometria. Separe com ---SEÇÃO---.' },
  { domain: 'Otorrinolaringologia', prompt: 'Guia conciso de ORL: OMA, sinusite, rinite ARIA, amigdalite, SAOS infantil (polissonografia), hipoacusia (triagem, implante coclear), epistaxe, vertigem. Separe com ---SEÇÃO---.' },
  { domain: 'Urologia', prompt: 'Guia conciso de Urologia: HPB (IPSS, cirurgia), ca próstata (PSA), litíase (litotripsia, ureteroscopia), ITU recorrente, urologia pediátrica (hipospádia, criptorquidia). Separe com ---SEÇÃO---.' },
  { domain: 'Fisioterapia e Reabilitação', prompt: 'Guia conciso de Fisio: musculoesquelética (exercícios, manipulação), respiratória (higiene brônquica, VNI, CPAP), neurológica (Bobath, AVC), esportiva, UTI (mobilização precoce). Separe com ---SEÇÃO---.' },
  { domain: 'Nutrição Clínica', prompt: 'Guia conciso de Nutrição: avaliação nutricional (ANTRO, BIA), enteral/parenteral (fórmulas, vias, complicações), dietas terapêuticas (FODMAP, cetogênica, DASH), nutrição pediátrica e oncológica. Separe com ---SEÇÃO---.' },
  { domain: 'Enfermagem', prompt: 'Guia conciso de Enfermagem: SAE (NANDA, NOC, NIC), administração de medicamentos, sondas/curativos, sinais vitais, UTI, pediátrica, saúde da família, biossegurança. Separe com ---SEÇÃO---.' },
  { domain: 'Terapia Ocupacional', prompt: 'Guia conciso de TO: avaliação funcional (FIM, COPM), AVD/AIVD, integração sensorial (Ayres), adaptação ambiental, TO pediátrica (autismo, TDAH), geriátrica. Separe com ---SEÇÃO---.' },
  { domain: 'Fonoaudiologia', prompt: 'Guia conciso de Fono: disfagia (FEES, videofluoroscopia), disfonia, linguagem infantil, afasia, fluência (gagueira), audição (triagem, prótese), miofuncional orofacial. Separe com ---SEÇÃO---.' },
  { domain: 'Medicina Baseada em Evidência', prompt: 'EBM: pirâmide de evidência, tipos de estudo, RoB 2, GRADE, NNT, RR, OR, meta-análise, heterogeneidade I², funnel plot, interpretação de guidelines. Separe com ---SEÇÃO---.' },
  { domain: 'Bibliotecas Científicas', prompt: 'Bibliotecas: PubMed (MeSH, Clinical Queries), Cochrane (revisões sistemáticas, GRADE, CENTRAL), BVS/LILACS/DeCS, SciELO, estratégias de busca avançada (booleanos, wildcards, campos MeSH). Separe com ---SEÇÃO---.' },
  { domain: 'Farmacologia', prompt: 'Farmacologia: ADME, farmacodinâmica (receptores, curva dose-resposta), interações (CYP450, indução/inibição), reações adversas A-F, farmacoterapia pediátrica, desprescrição. Separe com ---SEÇÃO---.' },
  { domain: 'Genética Médica', prompt: 'Genética: padrões de herança (AD, AR, X, mito), testes (cariótipo, array-CGH, WES, WGS, NIPT), aconselhamento, genética do câncer (BRCA, Lynch), triagem neonatal, CRISPR. Separe com ---SEÇÃO---.' },
  { domain: 'Saúde Coletiva e Epidemiologia', prompt: 'Saúde Coletiva: SUS (princípios, APS, ESF), vigilância epidemiológica (indicadores, surtos), indicadores (mortalidade, morbidade), determinantes sociais, promoção da saúde, equidade. Separe com ---SEÇÃO---.' },
  { domain: 'Assistência Social em Saúde', prompt: 'Assistência Social: SUAS, CRAS/CREAS, BPC/LOAS, rede de proteção (Conselho Tutelar, MP), vulnerabilidade social, pacientes crônicos na rua. Separe com ---SEÇÃO---.' },
  { domain: 'Cuidados Paliativos', prompt: 'Cuidados Paliativos: comunicação, diretivas antecipadas, controle de dor (escala OMS, opioides), dispneia, delirium, cuidados pediátricos, fim de vida, suporte psicossocial. Separe com ---SEÇÃO---.' },
  { domain: 'Reumatologia', prompt: 'Reumatologia: artrite reumatoide (ACR/EULAR, DMARDs, bio), lúpus (SLICC, nefrite lúpica), espondiloartrites, artrite juvenil, vasculites (ANCA, Kawasaki), imunodeficiências. Separe com ---SEÇÃO---.' },
  { domain: 'Organizações de Saúde', prompt: 'Organizações de Saúde: OMS/WHO (ICD, guidelines), OPAS, UNICEF (aleitamento, vacinas), CDC (imunização, MMWR), FDA, EMA, ANVISA, como acessar guidelines oficiais. Separe com ---SEÇÃO---.' },
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
          'X-Title': 'Atlas Corp RAG Extended',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4000,
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

async function ingestBatch(text: string, source: string): Promise<number> {
  try {
    const res = await fetch(`${BURL}/rag/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source }),
    });
    if (!res.ok) return 0;
    const json = await res.json();
    return json.chunkCount || 0;
  } catch {
    return 0;
  }
}

async function main() {
  console.log(`\nAlimentação RAG Extended - ${TOPICS.length} domínios\n`);

  let totalChunks = 0;
  let completed = 0;

  for (const topic of TOPICS) {
    try {
      const content = await llmGenerate(topic.prompt);
      if (!content) {
        console.log(`  ⏭ ${topic.domain}: vazio`);
        continue;
      }

      const sections = content.split('---SEÇÃO---').map(s => s.trim()).filter(Boolean);
      let domainChunks = 0;
      for (const section of sections) {
        domainChunks += await ingestBatch(section, topic.domain);
        await delay(200);
      }

      totalChunks += domainChunks;
      completed++;
      console.log(`  ✅ ${topic.domain}: ${sections.length} seções → ${domainChunks} chunks`);
    } catch (err) {
      console.log(`  ❌ ${topic.domain}: ${err instanceof Error ? err.message : String(err)}`);
    }

    await delay(3000);
  }

  console.log(`\nRESUMO: ${completed}/${TOPICS.length} domínios, ${totalChunks} chunks adicionados`);
  try {
    const statsRes = await fetch(`${BURL}/rag/stats`);
    const stats = await statsRes.json();
    console.log(`Total vetores no índice: ${stats.count}`);
  } catch {}
}

main().catch(console.error);
