import { readFile } from 'node:fs/promises';

const declaration = await readFile(
  new URL('../dist/worker/WorkerPoolManager.d.ts', import.meta.url),
  'utf8'
);

if (/import\s+\w+\s+from\s+['"]lru_map['"]/.test(declaration)) {
  throw new Error(
    'WorkerPoolManager declarations must not require synthetic default imports'
  );
}
