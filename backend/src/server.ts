import 'dotenv/config';
import { startAtlasBackendServer } from './app';

void startAtlasBackendServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
