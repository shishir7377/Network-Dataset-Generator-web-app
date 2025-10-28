import { describe, it, expect, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../pages/api/stop-capture";
import * as captureStore from "../lib/captureStore";

function resMock() {
  const res: Partial<NextApiResponse> = {};
  res.status = vi.fn().mockReturnThis() as any;
  res.json = vi.fn().mockReturnThis() as any;
  return res as NextApiResponse;
}

describe("/api/stop-capture", () => {
  it("405 for non-POST", async () => {
    const res = resMock();
    await handler({ method: "GET" } as any, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("signals stop for specific output", async () => {
    const res = resMock();
    const signalSpy = vi
      .spyOn(captureStore, "signalStop")
      .mockReturnValue(true);
    await handler({ method: "POST", body: { output: "x.csv" } } as any, res);
    expect(signalSpy).toHaveBeenCalledWith("x.csv");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("stops all when no output provided", async () => {
    const res = resMock();
    vi.spyOn(captureStore, "listActiveCaptures").mockReturnValue(["a", "b"]);
    vi.spyOn(captureStore, "signalStop").mockReturnValue(true);
    vi.spyOn(captureStore, "forceKillCapture").mockReturnValue(false);
    await handler({ method: "POST", body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
