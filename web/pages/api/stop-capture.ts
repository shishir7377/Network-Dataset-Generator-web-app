import type { NextApiRequest, NextApiResponse } from "next";
import {
  listActiveCaptures,
  signalStop,
  stopByKeyWithFallback,
  forceKillCapture,
} from "../../lib/captureStore";

type Data = {
  success: boolean;
  message?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  console.log("[STOP API] Received stop request");

  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const { output } = req.body || ({} as { output?: string });
    if (output) {
      const signaled = signalStop(output);
      if (signaled) {
        res.status(200).json({
          success: true,
          message: `Stop signal sent for ${output}`,
        });
        return;
      }

      const stopped = stopByKeyWithFallback(output);
      res.status(200).json({
        success: stopped,
        message: stopped
          ? `Stopped capture for ${output}`
          : `No active capture found for ${output}`,
      });
      return;
    }

    // If no specific output provided, stop all active captures (fallback)
    const active = listActiveCaptures();
    let message = "No active captures running.";
    let success = false;
    if (active.length > 0) {
      success = active.some((k) => signalStop(k) || forceKillCapture(k));
      message = `Stop signal sent for ${active.length} active capture(s).`;
    }
    res.status(200).json({ success, message });
  } catch (err: any) {
    console.error("[STOP API] Error:", err);
    res.status(500).json({
      success: false,
      message: err.message || String(err),
    });
  }
}
