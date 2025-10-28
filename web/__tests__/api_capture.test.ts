import { describe, it, expect, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import handler from "../pages/api/capture";

function createRes() {
  const res: Partial<NextApiResponse> = {};
  res.status = vi.fn().mockReturnThis() as any;
  res.json = vi.fn().mockReturnThis() as any;
  return res as NextApiResponse;
}

describe("/api/capture", () => {
  it("returns 405 on non-POST", async () => {
    const res = createRes();
    await handler({ method: "GET" } as any, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns 500 when executable missing", async () => {
    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const res = createRes();
    await handler({ method: "POST", body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(500);
    existsSpy.mockRestore();
  });
});
