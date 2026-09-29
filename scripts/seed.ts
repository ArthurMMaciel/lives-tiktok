import 'dotenv/config';
import { Pool } from 'pg';
import { developmentPuzzle } from '../apps/api/src/puzzle';

if (!process.env.DATABASE_URL) {
  console.info('DATABASE_URL não configurada. O puzzle de desenvolvimento já está embutido e pronto para o simulador.');
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
await pool.query(
  `insert into puzzles (id, title, image_a, image_b, status, created_at, definition)
   values ($1, $2, $3, $4, $5, $6, $7)
   on conflict (id) do update set title=excluded.title, image_a=excluded.image_a, image_b=excluded.image_b, status=excluded.status, definition=excluded.definition`,
  [developmentPuzzle.id, developmentPuzzle.title, developmentPuzzle.imageA, developmentPuzzle.imageB, developmentPuzzle.status, developmentPuzzle.createdAt, developmentPuzzle]
);
await pool.end();
console.info(`Puzzle ${developmentPuzzle.id} salvo.`);
