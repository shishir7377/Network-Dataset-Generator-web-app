import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";

// Import module under test
import * as store from "../lib/captureStore";

// Minimal fake ChildProcess shape for testing
function makeFakeChild(pid: number) {
  let killed = false;
  return {
    pid,
    killed,
    kill: vi.fn(() => {
      killed = true;
      (fake as any).killed = true;
      return true;
    }),
  } as any;
}

let fake: any;
const publicDir = path.join(process.cwd(), "public");
const registryPath = path.join(publicDir, ".captures.json");

describe("captureStore", () => {
  beforeEach(() => {
    // Cleanup public dir registry and any stop files
    if (fs.existsSync(registryPath)) fs.rmSync(registryPath, { force: true });
    fs.mkdirSync(publicDir, { recursive: true });
  });

  it("registers and lists active captures", () => {
    fake = makeFakeChild(1234);
    store.registerCapture(
      "test.csv",
      fake,
      path.join(publicDir, ".stop-test.signal")
    );

    const list = store.listActiveCaptures();
    expect(list).toContain("test.csv");
    // Registry persisted
    const persisted = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    expect(persisted.find((r: any) => r.key === "test.csv").pid).toBe(1234);
  });

  it("signalStop writes a stop signal file", () => {
    const stopFile = path.join(publicDir, ".stop-ab.signal");
    fake = makeFakeChild(2222);
    store.registerCapture("a.csv", fake, stopFile);
    const ok = store.signalStop("a.csv");
    expect(ok).toBe(true);
    expect(fs.existsSync(stopFile)).toBe(true);
  });

  it("stopByKeyWithFallback stops via signal or kills process/registry", () => {
    const stopFile = path.join(publicDir, ".stop-c.signal");
    fake = makeFakeChild(3333);
    store.registerCapture("c.csv", fake, stopFile);

    // When stop file present, signalStop should succeed
    expect(store.stopByKeyWithFallback("c.csv")).toBe(true);

    // If no entry, ensure function safely returns false
    expect(store.stopByKeyWithFallback("missing.csv")).toBe(false);
  });

  it("removeCapture removes from registry and memory", () => {
    fake = makeFakeChild(4444);
    store.registerCapture("d.csv", fake);
    store.removeCapture("d.csv");
    expect(store.listActiveCaptures()).not.toContain("d.csv");
    const persisted = fs.existsSync(registryPath)
      ? JSON.parse(fs.readFileSync(registryPath, "utf8"))
      : [];
    expect(persisted.find((r: any) => r.key === "d.csv")).toBeUndefined();
  });

  it("hasActiveCapture, getStopFilePath, stopAllCaptures cover helpers", () => {
    const stopFile = path.join(publicDir, ".stop-e.signal");
    fake = makeFakeChild(5555);
    store.registerCapture("e.csv", fake, stopFile);
    expect(store.hasActiveCapture("e.csv")).toBe(true);
    expect(store.getStopFilePath("e.csv")).toBe(stopFile);
    const stopped = store.stopAllCaptures();
    expect(stopped).toBeGreaterThanOrEqual(1);
  });
});
