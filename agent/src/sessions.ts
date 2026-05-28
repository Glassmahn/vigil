import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { logger } from "./logger";
import { RiskProfile } from "./risk-assessor";

interface StoredSession {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  riskProfile: RiskProfile | null;
  answers: Record<string, string>;
  currentQuestion: number | null;
  userAddress?: string;
  paused?: boolean;
}

const dbPath = process.env.SESSIONS_DB_PATH || path.join(process.cwd(), "data", "sessions.db");
let db: Database.Database | null = null;

try {
  const { dir } = path.parse(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      messages TEXT NOT NULL DEFAULT '[]',
      risk_profile TEXT,
      answers TEXT NOT NULL DEFAULT '{}',
      current_question INTEGER,
      user_address TEXT,
      paused INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  logger.info("Sessions", "SQLite database initialized", { path: dbPath });
} catch (e) {
  logger.warn("Sessions", "SQLite init failed, using in-memory fallback", { error: (e as Error).message });
}

function serialize(obj: any): string {
  return JSON.stringify(obj);
}

function deserialize<T>(val: string | null, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function save(id: string, s: StoredSession): void {
  if (!db) return;
  try {
    const existing = db.prepare("SELECT id FROM sessions WHERE id = ?").get(id);
    if (existing) {
      db.prepare(`
        UPDATE sessions SET messages=?, risk_profile=?, answers=?,
        current_question=?, user_address=?, paused=?, updated_at=datetime('now')
        WHERE id=?
      `).run(serialize(s.messages), serialize(s.riskProfile), serialize(s.answers),
        s.currentQuestion, s.userAddress || null, s.paused ? 1 : 0, id);
    } else {
      db.prepare(`INSERT INTO sessions (id,messages,risk_profile,answers,current_question,user_address,paused)
        VALUES (?,?,?,?,?,?,?)`).run(id, serialize(s.messages), serialize(s.riskProfile),
        serialize(s.answers), s.currentQuestion, s.userAddress || null, s.paused ? 1 : 0);
    }
  } catch (e) {
    logger.warn("Sessions", "Failed to persist session", { id, error: (e as Error).message });
  }
}

function load(id: string): StoredSession | undefined {
  if (!db) return undefined;
  try {
    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      messages: deserialize(row.messages, []),
      riskProfile: deserialize(row.risk_profile, null),
      answers: deserialize(row.answers, {}),
      currentQuestion: row.current_question,
      userAddress: row.user_address || undefined,
      paused: row.paused === 1,
    };
  } catch { return undefined; }
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export function createSessionStore() {
  const cache = new Map<string, { session: StoredSession; expiresAt: number }>();

  function isExpired(entry: { session: StoredSession; expiresAt: number }): boolean {
    return Date.now() > entry.expiresAt;
  }

  const cleanupTimer = setInterval(() => {
    for (const [id, entry] of cache) {
      if (isExpired(entry)) {
        cache.delete(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  if (cleanupTimer.unref) cleanupTimer.unref();

  return {
    stopCleanup: () => { clearInterval(cleanupTimer); },
    get(id: string): StoredSession | undefined {
      const entry = cache.get(id);
      if (entry) {
        if (isExpired(entry)) {
          cache.delete(id);
          return undefined;
        }
        return entry.session;
      }
      const fromDb = load(id);
      if (fromDb) {
        cache.set(id, { session: fromDb, expiresAt: Date.now() + SESSION_TTL_MS });
      }
      return fromDb;
    },

    set(id: string, session: StoredSession): void {
      cache.set(id, { session, expiresAt: Date.now() + SESSION_TTL_MS });
      save(id, session);
    },

    has(id: string): boolean {
      const entry = cache.get(id);
      if (entry) {
        if (isExpired(entry)) {
          cache.delete(id);
          return false;
        }
        return true;
      }
      if (!db) return false;
      try {
        const row = db.prepare("SELECT id FROM sessions WHERE id = ?").get(id);
        return !!row;
      } catch { return false; }
    },

    delete(id: string): void {
      cache.delete(id);
      if (db) {
        try { db.prepare("DELETE FROM sessions WHERE id = ?").run(id); } catch {}
      }
    },

    get size(): number {
      if (db) {
        try {
          const row = db.prepare("SELECT COUNT(*) as c FROM sessions").get() as any;
          return row.c;
        } catch {}
      }
      return cache.size;
    },

    keys(): string[] {
      const cached = Array.from(cache.keys());
      const dbKeys: string[] = [];
      if (db) {
        try {
          const rows = db.prepare("SELECT id FROM sessions").all() as any[];
          dbKeys.push(...rows.map((r: any) => r.id));
        } catch {}
      }
      return [...new Set([...cached, ...dbKeys])];
    },
  };
}
