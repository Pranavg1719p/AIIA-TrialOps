import fs from "fs";
import path from "path";
import { buildSeed } from "./seed";
import type { DB } from "./types";

/**
 * Adaptive demo-state store (LOCAL DEMO MODE).
 *
 * - "upstash": shared, persistent state on the free Upstash Redis tier.
 *   Enabled by setting UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 *   Works on serverless hosts (Vercel) where the filesystem is read-only.
 * - "file":    single-server persistence (local dev, Render, any Node host
 *   with a writable filesystem). Survives restarts until data/ is wiped.
 * - "memory":  fallback for serverless without Redis. State lives per server
 *   instance; a redeploy/restart reseeds. Clearly labelled in Settings.
 *
 * This is a simulated demo database by design — production path is Supabase
 * Postgres (see supabase/schema.sql).
 */

const DATA_VERSION = 1;
const REDIS_KEY = "aiia:demo-state:v1";

export type StoreMode = "upstash" | "file" | "memory";

const UP_URL = (process.env.UPSTASH_REDIS_REST_URL ?? "").replace(/\/+$/, "");
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

const g = globalThis as unknown as {
  __aiiaDB?: DB;
  __aiiaLoading?: Promise<DB> | null;
  __aiiaMode?: StoreMode;
};

function dataDir(): string {
  return path.join(process.cwd(), "data");
}
function dataFile(): string {
  return path.join(dataDir(), "demo-state.json");
}

function detectMode(): StoreMode {
  if (UP_URL && UP_TOKEN) return "upstash";
  if (process.env.VERCEL === "1") return "memory"; // serverless FS is not shareable
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    const probe = path.join(dataDir(), ".probe");
    fs.writeFileSync(probe, "1");
    fs.unlinkSync(probe);
    return "file";
  } catch {
    return "memory";
  }
}

function mode(): StoreMode {
  return (g.__aiiaMode ??= detectMode());
}

export function storeModeLabel(): string {
  switch (mode()) {
    case "upstash":
      return "UPSTASH REDIS (free tier) — shared & persistent across server instances";
    case "file":
      return "LOCAL FILE — persistent on this server (wiped if the host resets the disk)";
    default:
      return "MEMORY — per server instance; state resets on redeploy/restart (serverless mode without Redis)";
  }
}

/* ---------------- Upstash REST helpers (no TCP client needed) ---------------- */

async function redisSet(value: string): Promise<void> {
  const res = await fetch(`${UP_URL}/set/${REDIS_KEY}`, {
    method: "POST",
    headers: { authorization: `Bearer ${UP_TOKEN}`, "content-type": "text/plain" },
    body: value,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash set failed: HTTP ${res.status}`);
}

async function redisGet(): Promise<string | null> {
  const res = await fetch(`${UP_URL}/get/${REDIS_KEY}`, {
    headers: { authorization: `Bearer ${UP_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { result?: string | null };
  return j.result ?? null;
}

async function loadFromUpstash(): Promise<DB> {
  try {
    const raw = await redisGet();
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.meta?.version === DATA_VERSION) return parsed;
    }
  } catch (e) {
    console.error("[aiia] Upstash load failed — seeding fresh:", e);
  }
  const fresh = buildSeed(DATA_VERSION);
  try {
    await redisSet(JSON.stringify(fresh));
  } catch (e) {
    console.error("[aiia] Upstash seed push failed:", e);
  }
  return fresh;
}

/* ---------------- load / persist ---------------- */

function loadFromFile(): DB {
  try {
    const raw = fs.readFileSync(dataFile(), "utf8");
    const parsed = JSON.parse(raw) as DB;
    if (parsed.meta?.version === DATA_VERSION) return parsed;
  } catch {
    /* no persisted state — seed fresh */
  }
  const fresh = buildSeed(DATA_VERSION);
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(dataFile(), JSON.stringify(fresh));
  } catch (e) {
    console.error("[aiia] demo persistence failed:", e);
  }
  return fresh;
}

async function doLoad(): Promise<DB> {
  const m = mode();
  const loaded = m === "upstash" ? await loadFromUpstash() : m === "file" ? loadFromFile() : buildSeed(DATA_VERSION);
  g.__aiiaDB = loaded;
  return loaded;
}

/**
 * Await once per request entry-point (root layout, login page, and every API
 * route wrapper) so serverless cold starts hydrate shared state before render.
 */
export function ensureLoaded(): Promise<DB> {
  if (g.__aiiaDB) return Promise.resolve(g.__aiiaDB);
  g.__aiiaLoading ??= doLoad().finally(() => {
    g.__aiiaLoading = null;
  });
  return g.__aiiaLoading;
}

/** Synchronous access for server components — entry points call ensureLoaded() first. */
export function db(): DB {
  if (!g.__aiiaDB) {
    g.__aiiaDB = mode() === "file" ? loadFromFile() : buildSeed(DATA_VERSION);
  }
  return g.__aiiaDB;
}

/** Write-through persistence. API routes await this so state is durable before responding. */
export function persist(): Promise<void> {
  const d = g.__aiiaDB;
  if (!d) return Promise.resolve();
  const m = mode();
  if (m === "upstash") {
    return redisSet(JSON.stringify(d)).catch((e) => console.error("[aiia] Upstash persist failed:", e));
  }
  if (m === "file") {
    try {
      fs.mkdirSync(dataDir(), { recursive: true });
      fs.writeFileSync(dataFile(), JSON.stringify(d));
    } catch (e) {
      console.error("[aiia] demo persistence failed:", e);
    }
  }
  return Promise.resolve();
}

/** Swap in the original seeded state (caller persists afterwards). */
export function resetDb(): DB {
  const fresh = buildSeed(DATA_VERSION);
  g.__aiiaDB = fresh;
  return fresh;
}
