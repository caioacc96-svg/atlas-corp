/**
 * Atlas RAG — Teste de cobertura do índice
 * Pergunta sobre vários domínios e mostra quantos hits relevantes encontrou.
 */

const BURL = 'http://127.0.0.1:5589';

const TESTS = [
  { query: 'Qual o protocolo de manejo farmacológico na insuficiência cardíaca aguda pelo sistema NYHA?', label: 'Cardiologia' },
  { query: 'Como interpretar um ECG com supradesnivelamento do segmento ST e onda T invertida?', label: 'Cardiologia / ECG' },
  { query: 'Qual a diferença entre APLV IgE mediada e não IgE mediada?', label: 'Pediatria APLV' },
  { query: 'Como funciona o embedding nomic-embed-text e a cosine similarity em vector stores?', label: 'IA / Embeddings' },
  { query: 'O que são job queues e como implementar um scheduler assíncrono?', label: 'Backend / Arquitetura' },
  { query: 'Como funciona a compressão em áudio profissional? Ratio, attack e release.', label: 'Produção de Áudio' },
  { query: 'Como são classificados os tipos de estudo na pirâmide de evidência?', label: 'EBM' },
  { query: 'O que é o SUS e como funciona a atenção primária no Brasil?', label: 'Saúde Coletiva' },
  { query: 'Como usar PubMed com filtros MeSH para busca avançada?', label: 'Bibliotecas Científicas' },
  { query: 'Quais são os sinais de alarme na dengue e como manejar?', label: 'Infectologia' },
];

async function searchRag(query: string, topK = 5) {
  try {
    const res = await fetch(`${BURL}/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function main() {
  const statsRes = await fetch(`${BURL}/rag/stats`);
  const stats = await statsRes.json();

  console.log(`\n══════════════════════════════════════════════════════`);
  console.log(`   TESTE DE COBERTURA RAG — ATLAS CORP`);
  console.log(`   Total de vetores: ${stats.count}`);
  console.log(`   Arquivo: ${stats.filePath}`);
  console.log(`   Testes: ${TESTS.length} consultas`);
  console.log(`══════════════════════════════════════════════════════\n`);

  let totalHits = 0;
  let highScoreHits = 0;

  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    const hits = await searchRag(test.query, 5);
    const topScore = hits[0]?.score ?? 0;
    totalHits += hits.length;
    if (topScore > 0.3) highScoreHits++;

    const bar = '█'.repeat(Math.round(topScore * 20)) + '░'.repeat(Math.max(0, 20 - Math.round(topScore * 20)));
    const icon = topScore > 0.5 ? '[OK]' : topScore > 0.3 ? '[~]' : '[--]';
    const level = topScore > 0.5 ? 'ALTO' : topScore > 0.3 ? 'MEDIO' : 'BAIXO';

    console.log(`${icon} [${i + 1}/${TESTS.length}] ${test.label}`);
    console.log(`   Query: "${test.query}"`);
    console.log(`   ${hits.length} hits | Top: ${topScore.toFixed(3)} ${bar} ${level}`);

    if (hits[0] && topScore > 0.3) {
      const preview = hits[0].text.slice(0, 120).replace(/\n/g, ' ').trim();
      console.log(`   ↳ "${preview}..."`);
    }

    console.log();
  }

  console.log(`──────────────────────────────────────────────────────`);
  const pct = TESTS.length > 0 ? Math.round((highScoreHits / TESTS.length) * 100) : 0;
  console.log(`   RESULTADO: ${highScoreHits}/${TESTS.length} com score alto (> 0.3) = ${pct}%`);
  console.log(`   Média de hits por consulta: ${(totalHits / TESTS.length).toFixed(1)}`);
  const grade = pct > 80 ? 'A+' : pct > 60 ? 'B+' : pct > 40 ? 'C' : 'D';
  console.log(`   NOTA ATLAS: ${grade}`);
  console.log(`──────────────────────────────────────────────────────\n`);
}

main().catch(console.error);
