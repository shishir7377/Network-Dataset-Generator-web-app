import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

// System under test
import handler from "../pages/api/interfaces";

function createRes() {
  const res: Partial<NextApiResponse> = {};
  res.status = vi.fn().mockReturnThis() as any;
  res.json = vi.fn().mockReturnThis() as any;
  return res as NextApiResponse;
}

describe("/api/interfaces", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 405 on non-GET", async () => {
    const res = createRes();
    await handler({ method: "POST" } as any as NextApiRequest, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns 500 when executable is missing", async () => {
    const existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const res = createRes();
    await handler({ method: "GET" } as any, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
    existsSyncSpy.mockRestore();
  });
});
