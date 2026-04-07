import { RagIndex } from '../backend/src/lib/rag-index.ts';

console.log('Criando RagIndex com Ollama...');
const index = new RagIndex({
  embeddingApiUrl: 'http://127.0.0.1:11434/api/embed',
  embeddingApiKey: '',
  embeddingModel: 'nomic-embed-text',
});

console.log('Testando ingestão...');
const result = await index.ingest(
  'A alergia à proteína do leite de vaca (APLV) é a reação adversa mais comum às proteínas alimentares em lactentes. Afeta 3% das crianças. Diagnóstico clínico com exclusão e provocação oral.',
  { source: 'guia-aplv' }
);

console.log('Chunks indexados:', result.chunkCount);
console.log('Estatísticas:', index.stats());

console.log('Testando busca...');
const hits = await index.search('qual a prevalência da aplv em crianças?', 3);
console.log('Hits:', hits.length);
for (const hit of hits) {
  console.log(`  [${hit.score.toFixed(3)}] ${hit.text.slice(0, 80)}...`);
}
