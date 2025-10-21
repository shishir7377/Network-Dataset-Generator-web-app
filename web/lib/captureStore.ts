import { ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

type CaptureEntry = {
  child: ChildProcess;
  stopFile?: string;
};

// A simple in-memory store for active capture processes, keyed by an ID (e.g., output filename)
// Note: In dev mode, Next.js hot reloading can reload modules and reset this store.
// For production or more robustness, consider persisting lightweight state to a file or IPC.
const activeCaptures = new Map<string, CaptureEntry>();

type RegistryRecord = { key: string; pid: number; stopFile?: string };
const registryPath = path.join(process.cwd(), "public", ".captures.json");

function ensurePublicDir() {
  const publicDir = path.join(process.cwd(), "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
}

function readRegistry(): RegistryRecord[] {
  try {
    if (fs.existsSync(registryPath)) {
      const raw = fs.readFileSync(registryPath, "utf8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data as RegistryRecord[];
    }
  } catch {
    // ignore
  }
  return [];
}

function writeRegistry(records: RegistryRecord[]) {
  try {
    ensurePublicDir();
    fs.writeFileSync(registryPath, JSON.stringify(records, null, 2), "utf8");
  } catch {
    // ignore
  }
}

export function registerCapture(
  key: string,
  child: ChildProcess,
  stopFile?: string
) {
  // If an existing capture is registered with the same key, try to terminate it first
  const existing = activeCaptures.get(key);
  if (existing && !existing.child.killed) {
    try {
      existing.child.kill();
    } catch {
      // ignore
    }
  }
  activeCaptures.set(key, { child, stopFile });
  // Persist PID to registry for robustness across HMR
  const recs = readRegistry().filter((r) => r.key !== key);
  if (typeof child.pid === "number") {
    recs.push({ key, pid: child.pid, stopFile });
    writeRegistry(recs);
  }
}

export function removeCapture(key: string) {
  activeCaptures.delete(key);
  const recs = readRegistry().filter((r) => r.key !== key);
  writeRegistry(recs);
}

function forceKill(key: string): boolean {
  const entry = activeCaptures.get(key);
  const child = entry?.child;
  if (!child) return false;
  try {
    child.kill();
    return true;
  } catch {
    return false;
  } finally {
    activeCaptures.delete(key);
    const recs = readRegistry().filter((r) => r.key !== key);
    writeRegistry(recs);
  }
}

export function getStopFilePath(key: string): string | undefined {
  const entry = activeCaptures.get(key);
  if (entry?.stopFile) return entry.stopFile;
  const rec = readRegistry().find((r) => r.key === key);
  return rec?.stopFile;
}

export function signalStop(key: string): boolean {
  const stopPath = getStopFilePath(key);
  if (!stopPath) return false;
  try {
    ensurePublicDir();
    fs.writeFileSync(stopPath, Date.now().toString(), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function stopByKeyWithFallback(key: string): boolean {
  if (signalStop(key)) return true;

  // Fallback to in-memory or persisted child process kill
  if (forceKill(key)) return true;

  const recs = readRegistry();
  const rec = recs.find((r) => r.key === key);
  if (rec && rec.pid) {
    try {
      process.kill(rec.pid);
      const next = recs.filter((r) => r.key !== key);
      writeRegistry(next);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function forceKillCapture(key: string): boolean {
  return forceKill(key);
}

export function stopAllCaptures(): number {
  let count = 0;
  for (const [key] of activeCaptures.entries()) {
    if (forceKill(key)) {
      count++;
    }
  }
  // Also clear registry
  writeRegistry([]);
  return count;
}

export function hasActiveCapture(key: string): boolean {
  return activeCaptures.has(key);
}

export function listActiveCaptures(): string[] {
  return Array.from(activeCaptures.keys());
}
