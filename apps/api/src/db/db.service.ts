import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private _db!: Database.Database;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>('DB_PATH') ?? './data/provenance.db';
    const path = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
    mkdirSync(dirname(path), { recursive: true });
    this._db = new Database(path);
    this._db.pragma('journal_mode = WAL');
    this._db.pragma('foreign_keys = ON');
    this.migrate();
    this.logger.log(`sqlite ready at ${path}`);
  }

  onModuleDestroy() {
    this._db?.close();
  }

  get db(): Database.Database {
    return this._db;
  }

  private migrate() {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS lineage_entries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        parent_ids TEXT NOT NULL,
        op_type TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lineage_project_node
        ON lineage_entries (project_id, node_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_lineage_project_created
        ON lineage_entries (project_id, created_at);
    `);

    // Bit 5: full post-op workflow snapshot for output-node generations,
    // so graph-diff can compare any two generations.
    const cols = this._db
      .prepare(`PRAGMA table_info(lineage_entries)`)
      .all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'workflow_snapshot')) {
      this._db.exec(`ALTER TABLE lineage_entries ADD COLUMN workflow_snapshot TEXT`);
    }
  }
}
