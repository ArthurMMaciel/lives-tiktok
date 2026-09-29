import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Pool } from 'pg';
import type { EventStore, StoredEvent } from '@seven-errors/application';

export class FileEventStore implements EventStore {
  constructor(private readonly path: string) {}
  async append(event: StoredEvent): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 });
  }
}

export class PostgresEventStore implements EventStore {
  private readonly pool: Pool;
  constructor(connectionString: string) { this.pool = new Pool({ connectionString, max: 3, ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } }); }
  async append(event: StoredEvent): Promise<void> {
    await this.pool.query('insert into game_events (event_type, occurred_at, payload) values ($1, $2, $3)', [event.type, event.occurredAt, event.payload]);
  }
}
