import type { NextApiRequest, NextApiResponse } from "next";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

type Interface = {
  id: string;
  name: string;
  description: string;
  isUp: boolean;
  hasAddresses: boolean;
  isLoopback: boolean;
};

type Data = {
  success: boolean;
  interfaces?: Interface[];
  message?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  console.log("[API /interfaces] Received request:", req.method);

  if (req.method !== "GET") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  // Find the executable
  const repoRoot = path.resolve(process.cwd(), "..");
  const exeBase = "NetworkPacketAnalyzer";
  const candidates = [
    path.join(repoRoot, "build", "Release", exeBase + ".exe"),
    path.join(repoRoot, "build", exeBase + ".exe"),
    path.join(repoRoot, "build", exeBase),
  ];

  const exePath = candidates.find((p) => fs.existsSync(p));
  if (!exePath) {
    console.log("[API /interfaces] ERROR: Executable not found");
    res.status(500).json({
      success: false,
      message: "Sniffer executable not found. Build with CMake first.",
    });
    return;
  }

  console.log("[API /interfaces] Found executable:", exePath);

  try {
    // Run the executable with --list-interfaces to get JSON output
    const result = await new Promise<Data>((resolve, reject) => {
      const child = spawn(exePath, ["--list-interfaces"], {
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (err) => {
        console.error("[API /interfaces] Child process error:", err);
        reject(new Error("Failed to list interfaces: " + String(err)));
      });

      child.on("close", (code) => {
        console.log("[API /interfaces] Process closed with code:", code);
        console.log("[API /interfaces] Stdout:", stdout);
        console.log("[API /interfaces] Stderr:", stderr);

        if (code !== 0) {
          console.error(
            "[API /interfaces] Process exited with error code:",
            code
          );
          reject(new Error(`Failed to list interfaces (exit code ${code})`));
          return;
        }

        try {
          // Trim whitespace and parse JSON output from the C++ executable
          const trimmedOutput = stdout.trim();
          console.log(
            "[API /interfaces] Trimmed output length:",
            trimmedOutput.length
          );

          const jsonData = JSON.parse(trimmedOutput);

          if (!jsonData.success) {
            resolve({
              success: false,
              message: jsonData.error || "Failed to list interfaces",
            });
            return;
          }

          const interfaces: Interface[] = jsonData.interfaces.map(
            (iface: any) => ({
              id: iface.id,
              name: iface.name,
              description: iface.description,
              isUp: iface.isUp,
              hasAddresses: iface.hasAddresses,
              isLoopback: iface.isLoopback,
            })
          );

          console.log(
            "[API /interfaces] Parsed interfaces:",
            interfaces.length
          );
          resolve({ success: true, interfaces });
        } catch (err) {
          console.error("[API /interfaces] Failed to parse JSON:", err);
          console.error(
            "[API /interfaces] Raw output (first 500 chars):",
            stdout.substring(0, 500)
          );
          console.error(
            "[API /interfaces] Raw output (last 500 chars):",
            stdout.substring(stdout.length - 500)
          );
          reject(new Error("Failed to parse interface list: " + String(err)));
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error("Timeout waiting for interface list"));
      }, 5000);
    });

    res.status(200).json(result);
  } catch (err: any) {
    console.error("[API /interfaces] Catch block error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: errorMessage });
  }
}
