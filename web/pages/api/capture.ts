import type { NextApiRequest, NextApiResponse } from "next";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { registerCapture, removeCapture } from "../../lib/captureStore";

type Data = {
  success: boolean;
  message?: string;
};

// Active capture processes are tracked via web/lib/captureStore

// Configure API route for longer execution times
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
    // Extend timeout for long captures (default is 10s in dev, 60s in production)
    responseLimit: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  console.log("[API] Received request:", req.method, req.body);

  if (req.method !== "POST") {
    console.log("[API] Method not allowed:", req.method);
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  const {
    output = "packet_capture.csv",
    iface = "",
    filter = "both",
    duration = 10,
    promiscuous = "on", // New parameter: 'on' or 'off'
  } = req.body;
  console.log("[API] Parsed params:", {
    output,
    iface,
    filter,
    duration,
    promiscuous,
  });

  // Determine repository root and executable candidates
  const repoRoot = path.resolve(process.cwd(), "..");
  console.log("[API] Repo root:", repoRoot);
  console.log("[API] Process cwd:", process.cwd());

  const exeBase = "NetworkPacketAnalyzer";
  const candidates = [
    path.join(repoRoot, "build", "Release", exeBase + ".exe"),
    path.join(repoRoot, "build", exeBase + ".exe"),
    path.join(repoRoot, "build", exeBase),
  ];

  console.log("[API] Searching for executable in candidates:");
  candidates.forEach((c) =>
    console.log("  -", c, fs.existsSync(c) ? "✓" : "✗")
  );

  const exePath = candidates.find((p) => fs.existsSync(p));
  if (!exePath) {
    console.log("[API] ERROR: Executable not found in any candidate path");
    res.status(500).json({
      success: false,
      message: "Sniffer executable not found. Build the C++ project first.",
    });
    return;
  }

  console.log("[API] Found executable:", exePath);

  // Ensure public directory exists
  const publicDir = path.join(process.cwd(), "public");
  if (!fs.existsSync(publicDir)) {
    console.log("[API] Creating public directory:", publicDir);
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outPath = path.join(publicDir, output);
  console.log("[API] Output CSV path:", outPath);

  const safeBase = path
    .basename(output)
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .replace(/\.{2,}/g, ".");
  const stopFilePath = path.join(
    publicDir,
    `.stop-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}-${safeBase}.signal`
  );
  if (fs.existsSync(stopFilePath)) {
    fs.rmSync(stopFilePath, { force: true });
  }
  console.log("[API] Stop signal file:", stopFilePath);

  // If no interface specified, use 'auto'
  const interfaceArg = iface || "auto";
  console.log("[API] Interface arg:", interfaceArg);

  // Validate promiscuous mode
  const promiscuousMode = promiscuous === "off" ? "off" : "on";

  try {
    // Use API argument format: <output> <interface> <filter> <duration> <promiscuous>
    const args = [
      outPath,
      interfaceArg,
      filter || "both",
      String(duration),
      promiscuousMode,
      stopFilePath,
    ];
    console.log("[API] Spawning sniffer with args:", args);

    // Wrap spawn in a Promise to properly await completion
    const result = await new Promise<{ success: boolean; message: string }>(
      (resolve, reject) => {
        const child = spawn(exePath, args, { windowsHide: true });

        // Store process for potential cancellation
        // Use output filename as key (unique per capture request)
        registerCapture(output, child, stopFilePath);

        let stdout = "";
        let stderr = "";

        // Set up safety timeout based on duration (small buffer for init/flush)
        // Now that the native app self-stops at duration, we only need a small cushion.
        const timeoutMs =
          duration > 0 ? duration * 1000 + 5000 : 24 * 60 * 60 * 1000; // duration + 5s, or 24h max for unlimited
        const timeoutHandle = setTimeout(() => {
          console.log("[API] Capture timeout reached, terminating process");
          child.kill("SIGTERM");
        }, timeoutMs);

        child.stdout?.on("data", (chunk) => {
          const data = chunk.toString();
          stdout += data;
          console.log("[SNIFFER]", data.trim());
        });

        child.stderr?.on("data", (chunk) => {
          const data = chunk.toString();
          stderr += data;
          console.error("[SNIFFER ERROR]", data.trim());
        });

        child.on("error", (err) => {
          console.error("[API] Child process error:", err);
          clearTimeout(timeoutHandle);
          removeCapture(output);
          try {
            fs.rmSync(stopFilePath, { force: true });
          } catch {
            // ignore
          }
          reject({
            success: false,
            message: "Failed to start sniffer: " + String(err),
          });
        });

        child.on("close", (code) => {
          console.log("[API] Child process closed with code:", code);
          clearTimeout(timeoutHandle);
          removeCapture(output);
          try {
            fs.rmSync(stopFilePath, { force: true });
          } catch {
            // ignore
          }
          console.log("[API] Stdout:", stdout);
          console.log("[API] Stderr:", stderr);

          // code can be null if process was killed/terminated
          if (code !== 0 && code !== null) {
            console.error("[API] Sniffer exited with error code:", code);
            reject({
              success: false,
              message: `Sniffer exited with code ${code}. ${stderr}`,
            });
            return;
          }

          if (!fs.existsSync(outPath)) {
            console.error(
              "[API] Output file not found after capture:",
              outPath
            );
            reject({
              success: false,
              message: "Capture finished but output file not found.",
            });
            return;
          }

          const fileSize = fs.statSync(outPath).size;
          console.log(
            "[API] Output file created successfully:",
            outPath,
            "Size:",
            fileSize,
            "bytes"
          );

          const publicUrl = `/${output}`;
          console.log("[API] Returning public URL:", publicUrl);
          resolve({ success: true, message: publicUrl });
        });
      }
    );

    console.log("[API] Sending response:", result);
    res.status(200).json(result);
  } catch (err: any) {
    console.error("[API] Catch block error:", err);
    try {
      fs.rmSync(stopFilePath, { force: true });
    } catch {
      // ignore
    }
    res
      .status(500)
      .json({ success: false, message: err.message || String(err) });
  }
}
