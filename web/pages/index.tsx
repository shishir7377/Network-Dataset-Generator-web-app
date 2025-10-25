"use client";
import { useState, useEffect } from "react";

type Interface = {
  id: string;
  name: string;
  description: string;
  isUp: boolean;
  hasAddresses: boolean;
  isLoopback: boolean;
};

export default function Home() {
  const [iface, setIface] = useState("");
  const [output, setOutput] = useState("packet_capture.csv");
  // Multi-select filter state
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

  // Fetch available interfaces on component mount
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
        setInterfaces([]); // Set empty array on failure
      }
    } catch (err) {
      console.error("[Frontend] Error fetching interfaces:", err);
      setInterfaces([]); // Set empty array on error
    } finally {
      setLoadingInterfaces(false);
    }
  }

  // Timer effect for elapsed time display
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
    setIsLoading(true);
    setStatus("Starting capture...");
    setDownloadUrl(null);
    setCaptureStartTime(Date.now());
    setElapsedTime(0);

    // Compose filter string for backend
    const filterString = filters.length === 0 ? "both" : filters.join(",");

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output,
          iface,
          filter: filterString,
          duration,
          promiscuous: promiscuous ? "on" : "off",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("✅ Capture complete!");
        setDownloadUrl(data.message);
      } else {
        setStatus("❌ Error: " + data.message);
      }
    } catch (err: any) {
      setStatus("❌ Request failed: " + String(err));
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
        setStatus("🛑 Capture stopped. Waiting for file...");
      } else {
        setStatus("⚠️ " + data.message);
      }
    } catch (err: any) {
      setStatus("❌ Stop failed: " + String(err));
    }
  }

  return (
    <div className="container">
      <main className="main">
        <h1 className="title">Network Dataset Generator</h1>

        <section className="card" aria-labelledby="requirements">
          <h3 id="requirements">⚠️ Important Requirements</h3>
          <ul>
            <li>
              Run VS Code or your terminal <strong>as Administrator</strong>
              (required for packet capture)
            </li>
            <li>Generate network traffic during capture (browse, ping, download)</li>
            <li>
              Ensure Npcap service is running: <code>sc query npcap</code>
            </li>
          </ul>
        </section>

        <form onSubmit={startCapture} className="form" aria-label="capture form">
          {/* Move output filename to the very top */}
          <div className="form-group">
            <label className="label">Output filename</label>
            <input
              className="input"
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              disabled={isLoading}
              aria-label="output filename"
            />
          </div>

          {/* Interface selection stays the same */}
          <div className="form-group">
            <label className="label">Interface</label>
            {loadingInterfaces ? (
              <div>
                <span className="spinner" aria-hidden /> Loading interfaces...
              </div>
            ) : (
              <div className="row">
                <select
                  className="select"
                  value={iface}
                  onChange={(e) => setIface(e.target.value)}
                  disabled={isLoading}
                  aria-label="network interface"
                >
                  <option value="">Auto-select (recommended)</option>
                  {interfaces.map((int) => (
                    <option key={int.id} value={int.id}>
                      {int.description}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={fetchInterfaces}
                  className="button refresh-btn"
                  disabled={loadingInterfaces || isLoading}
                  aria-label="refresh interfaces"
                >
                  🔄
                </button>
              </div>
            )}
            <div>
              <small className="subtitle">
                Tip: choose an active adapter (WiFi/Ethernet). Auto-select picks the first active one.
              </small>
            </div>
          </div>

          {/* Neon toggle buttons for filter selection */}
          <div className="form-group">
            <label className="label">Packet Types</label>
            <div className="row" style={{ gap: 12 }}>
              {[
                { key: "ipv4", label: "IPv4" },
                { key: "ipv6", label: "IPv6" },
                { key: "icmp", label: "ICMP" },
                { key: "bgp", label: "BGP" },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.key}
                  className={`neon-toggle${filters.includes(opt.key) ? " selected" : ""}`}
                  style={{ minWidth: 70 }}
                  onClick={() => {
                    setFilters((prev) =>
                      prev.includes(opt.key)
                        ? prev.filter((f) => f !== opt.key)
                        : [...prev, opt.key]
                    );
                  }}
                  disabled={isLoading}
                  aria-pressed={filters.includes(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <small className="subtitle">Select one or more packet types to capture. Default: IPv4 & IPv6.</small>
          </div>

          <div className="form-group">
            <label className="label">Duration (seconds, 0 = until stopped)</label>
            <input
              className="input"
              type="number"
              min={0}
              value={duration}
              onChange={(e) => handleDurationChange(Number(e.target.value))}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label className="label">
              <input
                type="checkbox"
                checked={promiscuous}
                onChange={(e) => setPromiscuous(e.target.checked)}
                disabled={isLoading}
                style={{ marginRight: 8 }}
              />
              Promiscuous Mode
            </label>
            <small className="subtitle">
              When enabled, captures ALL packets on the network (not just those destined for this machine).
            </small>
          </div>

          <div className="form-group">
            <button type="submit" className="button" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner" aria-hidden /> Capturing...
                </>
              ) : (
                "🚀 Start Capture"
              )}
            </button>
          </div>

          {isLoading && (
            <div className="card status status-pending">
              <div className="row" style={{ alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0 }}>
                    ⏱️ Elapsed: {elapsedTime}s{duration > 0 && ` / ${duration}s`}
                  </p>
                  <div className="progress" aria-hidden>
                    <div
                      className="progress-bar"
                      style={{
                        width: duration > 0 ? `${Math.min(100, (elapsedTime / duration) * 100)}%` : "100%",
                      }}
                    />
                  </div>
                </div>
                <div style={{ marginLeft: 12 }}>
                  {isUnlimited && (
                    <button type="button" className="button" onClick={stopCapture}>
                      🛑 Stop
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>

        {status && (
          <div style={{ marginTop: 20 }}>
            <div className={`status ${status.startsWith("✅") ? "status-success" : status.startsWith("❌") ? "status-error" : "status-pending"}`}>
              <p style={{ margin: 0, fontSize: 16 }}>{status}</p>
              {downloadUrl && (
                <div style={{ marginTop: 12 }}>
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="button" style={{ display: "inline-block", textDecoration: "none" }}>
                    📥 Download CSV File
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
