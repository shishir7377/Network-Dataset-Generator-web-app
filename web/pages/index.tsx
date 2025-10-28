"use client";
import { useState, useEffect, useRef } from "react";

type Interface = {
  id: string;
  name: string;
  description: string;
  isUp: boolean;
  hasAddresses: boolean;
  isLoopback: boolean;
};
const MAROON = "#66152b";
const MAROON_DARK = "#4b0f1f";
const CREAM = "#FFF7E6";

export default function Home() {
  const [iface, setIface] = useState("");
  const [output, setOutput] = useState("packet_capture.csv");
  const [filters, setFilters] = useState<string[]>(["ipv4", "ipv6"]);
  const [duration, setDuration] = useState(10);
  const [promiscuous, setPromiscuous] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [interfaces, setInterfaces] = useState<Interface[]>([]);
  const [loadingInterfaces, setLoadingInterfaces] = useState(false);
  const [captureStartTime, setCaptureStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    fetchInterfaces();
  }, []);

  async function fetchInterfaces() {
    setLoadingInterfaces(true);
    console.log("[Frontend] Fetching interfaces...");
    try {
      const res = await fetch("/api/interfaces");
      console.log("[Frontend] Response status:", res.status);
      const data = await res.json();
      console.log("[Frontend] Response data:", data);
      if (data.success && data.interfaces) {
        setInterfaces(data.interfaces);
        console.log("[Frontend] Loaded interfaces:", data.interfaces);
      } else {
        console.error("[Frontend] Failed to load interfaces:", data.message);
        setInterfaces([]);
      }
    } catch (err) {
      console.error("[Frontend] Error fetching interfaces:", err);
      setInterfaces([]);
    } finally {
      setLoadingInterfaces(false);
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isLoading && captureStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - captureStartTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, captureStartTime]);

  async function startCapture(e: any) {
    e.preventDefault();
    if (!filters || filters.length === 0) {
      setStatus("Select at least one packet type.");
      return;
    }
    setIsLoading(true);
    setStatus("Starting capture...");
    setDownloadUrl(null);
    setCaptureStartTime(Date.now());
    setElapsedTime(0);

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output,
          iface,
          filters,
          duration,
          promiscuous: promiscuous ? "on" : "off",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("Capture complete!");
        setDownloadUrl(data.message);
      } else {
        setStatus("Error: " + data.message);
      }
    } catch (err: any) {
      setStatus("Request failed: " + String(err));
    } finally {
      setIsLoading(false);
      setCaptureStartTime(null);
    }
  }

  function handleDurationChange(value: number) {
    setDuration(value);
    setIsUnlimited(value === 0);
  }

  async function stopCapture() {
    try {
      setStatus("Stopping capture...");
      const res = await fetch("/api/stop-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("Capture stopped. Waiting for file...");
      } else {
        setStatus("Warning: " + data.message);
      }
    } catch (err: any) {
      setStatus("Stop failed: " + String(err));
    }
  }

  return (
    <main
      style={{
        padding: 24,
        backgroundColor: "#FFF7E6",
        color: MAROON,
        minHeight: "100vh",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: "720px",
          margin: "40px auto",
          background: "linear-gradient(to bottom, #ffffff, #fff9f2)",
          padding: "36px",
          borderRadius: "12px",
          border: "1px solid rgba(106,28,55,0.06)",
          boxShadow: "0 10px 30px rgba(106,28,55,0.06)",
        }}
      >
        <h1
          style={{
            color: MAROON_DARK,
            marginTop: 0,
            marginBottom: "20px",
            fontSize: "30px",
            textAlign: "center",
          }}
        >
          Network Dataset Generator
        </h1>

        <form onSubmit={startCapture}>
          <div style={{ marginBottom: "30px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "10px",
                color: MAROON,
                fontSize: "16px",
              }}
            >
              Output filename:{" "}
            </label>
            <input
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "16px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                backgroundColor: "white",
                color: MAROON,
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "10px",
                color: MAROON,
                fontSize: "16px",
              }}
            >
              Select Network Interface:{" "}
            </label>
            {loadingInterfaces ? (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <span>Loading interfaces...</span>
              </div>
            ) : (
              <div style={{ marginBottom: "20px" }}>
                <select
                  value={iface}
                  onChange={(e) => setIface(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: "16px",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                    backgroundColor: "white",
                    color: MAROON,
                    marginBottom: "10px",
                  }}
                >
                  <option value="">Auto-select (recommended)</option>
                  {interfaces.map((int) => {
                    const desc = int.description || int.name || "";
                    const dlow = desc.toLowerCase();
                    const vendorRec = [
                      "intel",
                      "realtek",
                      "qualcomm",
                      "atheros",
                      "broadcom",
                      "killer",
                      "marvell",
                      "tp-link",
                      "d-link",
                    ].some((v) => dlow.includes(v));
                    return (
                      <option key={int.id} value={int.id}>
                        {desc}
                        {vendorRec
                          ? " [Recommended]"
                          : int.isUp
                          ? ""
                          : " (DOWN)"}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={fetchInterfaces}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    border: "none",
                    borderRadius: "6px",
                    backgroundColor: "#fff1f6",
                    color: MAROON,
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                  }}
                  disabled={loadingInterfaces}
                >
                  Refresh Interfaces
                </button>
              </div>
            )}
          </div>
          <div style={{ marginBottom: "30px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "15px",
                color: "#2c3e50",
                fontSize: "16px",
              }}
            >
              Packet Types:
            </label>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {[
                { key: "ipv4", label: "IPv4" },
                { key: "ipv6", label: "IPv6" },
                { key: "icmp", label: "ICMP" },
                { key: "bgp", label: "BGP" },
              ].map((opt) => (
                <label
                  key={opt.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "white",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filters.includes(opt.key)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFilters((prev) => {
                        if (checked) {
                          const next = Array.from(new Set([...prev, opt.key]));
                          return next.length ? next : ["ipv4", "ipv6"];
                        } else {
                          const next = prev.filter((f) => f !== opt.key);
                          return next.length ? next : [];
                        }
                      });
                    }}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span style={{ color: MAROON }}>{opt.label}</span>
                </label>
              ))}
            </div>
            <p style={{ marginTop: "10px", color: MAROON, fontSize: "13px" }}>
              Select any combination. Default is IPv4 and IPv6.
            </p>
          </div>
          <div style={{ marginBottom: "30px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "15px",
                color: MAROON,
                fontSize: "16px",
              }}
            >
              Capture Duration:
            </label>
            <div
              style={{
                display: "flex",
                gap: "15px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => handleDurationChange(0)}
                style={{
                  padding: "12px 24px",
                  background:
                    duration === 0
                      ? "linear-gradient(to bottom, #7a1b36, #66152b)"
                      : "white",
                  color: duration === 0 ? CREAM : MAROON,
                  border: `1px solid ${duration === 0 ? "#4b0f1f" : "#e0e0e0"}`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: duration === 0 ? "600" : "normal",
                  transition: "all 0.18s ease",
                  boxShadow:
                    duration === 0
                      ? "0 8px 20px rgba(90, 34, 66, 0.14)"
                      : "none",
                }}
              >
                Unlimited
              </button>
              <button
                type="button"
                onClick={() => handleDurationChange(30)}
                style={{
                  padding: "12px 24px",
                  background:
                    duration === 30
                      ? "linear-gradient(to bottom, #7a1b36, #66152b)"
                      : "white",
                  color: duration === 30 ? CREAM : MAROON,
                  border: `1px solid ${
                    duration === 30 ? "#4b0f1f" : "#e0e0e0"
                  }`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: duration === 30 ? "600" : "normal",
                  transition: "all 0.18s ease",
                  boxShadow:
                    duration === 30
                      ? "0 8px 20px rgba(90, 34, 66, 0.14)"
                      : "none",
                }}
              >
                30s
              </button>
              <button
                type="button"
                onClick={() => handleDurationChange(60)}
                style={{
                  padding: "12px 24px",
                  background:
                    duration === 60
                      ? "linear-gradient(to bottom, #7a1b36, #66152b)"
                      : "white",
                  color: duration === 60 ? CREAM : MAROON,
                  border: `1px solid ${
                    duration === 60 ? "#4b0f1f" : "#e0e0e0"
                  }`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: duration === 60 ? "600" : "normal",
                  transition: "all 0.18s ease",
                  boxShadow:
                    duration === 60
                      ? "0 8px 20px rgba(90, 34, 66, 0.14)"
                      : "none",
                }}
              >
                1m
              </button>
              <button
                type="button"
                onClick={() => handleDurationChange(300)}
                style={{
                  padding: "12px 24px",
                  background:
                    duration === 300
                      ? "linear-gradient(to bottom, #7a1b36, #66152b)"
                      : "white",
                  color: duration === 300 ? CREAM : MAROON,
                  border: `1px solid ${
                    duration === 300 ? "#4b0f1f" : "#e0e0e0"
                  }`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: duration === 300 ? "600" : "normal",
                  transition: "all 0.18s ease",
                  boxShadow:
                    duration === 300
                      ? "0 8px 20px rgba(90, 34, 66, 0.14)"
                      : "none",
                }}
              >
                5m
              </button>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => handleDurationChange(Number(e.target.value))}
                  style={{
                    padding: "12px",
                    width: "100px",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                    fontSize: "15px",
                    color: MAROON,
                  }}
                  placeholder="Custom"
                />
                <span style={{ color: "#666", fontSize: "14px" }}>seconds</span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginBottom: "30px",
              padding: "20px",
              backgroundColor: "white",
              borderRadius: "10px",
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <input
                type="checkbox"
                checked={promiscuous}
                onChange={(e) => setPromiscuous(e.target.checked)}
                style={{
                  marginRight: "12px",
                  width: "20px",
                  height: "20px",
                  cursor: "pointer",
                }}
              />
              <span
                style={{
                  fontSize: "16px",
                  color: MAROON,
                  fontWeight: "500",
                }}
              >
                Promiscuous Mode
              </span>
            </label>
            <p
              style={{
                margin: "0",
                color: MAROON,
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            >
              When enabled, captures ALL packets on the network. Useful for
              comprehensive network monitoring.
            </p>
          </div>

          <div
            style={{
              marginTop: "20px",
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: "12px 28px",
                fontSize: "16px",
                background: isLoading
                  ? "#e9dfe3"
                  : "linear-gradient(to bottom, #7a1b36, #66152b)",
                color: isLoading ? MAROON : CREAM,
                border: "none",
                borderRadius: "10px",
                cursor: isLoading ? "not-allowed" : "pointer",
                boxShadow: isLoading
                  ? "none"
                  : "0 10px 26px rgba(106,28,55,0.14)",
              }}
            >
              {isLoading ? "Capturing..." : "Start Capture"}
            </button>

            {isLoading && (
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    padding: "15px",
                    backgroundColor: "#fff9ed",
                    borderRadius: "8px",
                    border: "1px solid #fff6ee",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <p style={{ margin: "0", fontSize: "16px" }}>
                      Elapsed: {elapsedTime}s{duration > 0 && ` / ${duration}s`}
                    </p>
                    {isUnlimited && (
                      <button
                        type="button"
                        onClick={stopCapture}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#ff4444",
                          color: "white",
                          border: "none",
                          borderRadius: "5px",
                          cursor: "pointer",
                        }}
                      >
                        Stop Capture
                      </button>
                    )}
                  </div>
                  <p
                    style={{
                      margin: "5px 0 0 0",
                      fontSize: "13px",
                      color: MAROON,
                    }}
                  >
                    Capture is running in the background. The page will update
                    when complete.
                  </p>
                </div>
              </div>
            )}
          </div>
        </form>

        {status && (
          <div
            style={{
              marginTop: "30px",
              textAlign: "center",
              padding: "20px",
              backgroundColor: "white",
              borderRadius: "10px",
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            <p
              style={{
                fontSize: "18px",
                marginBottom: "15px",
                color: MAROON,
              }}
            >
              {status}
            </p>
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  padding: "12px 24px",
                  backgroundColor: "#D4AF37",
                  color: MAROON,
                  borderRadius: "8px",
                  transition: "background-color 0.12s ease",
                  boxShadow: "0 8px 22px rgba(212,175,55,0.12)",
                }}
              >
                Download CSV File
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
