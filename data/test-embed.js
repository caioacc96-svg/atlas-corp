import { embedTexts } from '../backend/src/lib/rag-index.ts';

const result = await embedTexts(['teste de embedding com texto em portugues'], {
  apiUrl: 'http://127.0.0.1:11434/api/embed',
  model: 'nomic-embed-text',
  apiKey: '',
});

console.log('Embeddings:', result.length);
console.log('Dimensão:', result[0]?.length);
