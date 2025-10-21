# Network Dataset Generator

A full-stack network packet capture and analysis tool with a high-performance C++ backend and modern Next.js web interface.

## 🚀 Features

### C++ Backend Sniffer

- **Multi-protocol capture**: IPv4, IPv6, ICMP, BGP, and all IP traffic
- **Comprehensive header extraction**: Every field from IP packets parsed and exported
- **Flexible filtering**: Protocol-specific filters with BPF support
- **Promiscuous mode control**: Capture network-wide or local-only traffic
- **Precision timing**: Duration-based capture with exact timeout enforcement
- **Multiple interfaces**: Interactive selection, auto-detection, or API-driven
- **Structured CSV output**: Clean, escaped CSV with timestamp and full packet metadata
- **Cross-platform**: Windows (Npcap) and Linux (libpcap)
- **Real-time stats**: Live packet rate, protocol breakdown, and progress indicators

### Next.js Web Frontend

- **Intuitive UI**: Clean, responsive web interface for packet capture
- **Smart interface selection**: Auto-detect active adapters with status indicators
- **Flexible capture modes**:
  - Timed captures (2s, 10s, 30s, etc.)
  - Unlimited duration with manual stop control
- **On-demand downloads**: Explicit download button (no auto-download)
- **Stop button for unlimited captures**: Gracefully terminate long-running captures from the UI
- **Real-time status**: Elapsed time counter and capture progress
- **Promiscuous mode toggle**: Enable/disable network-wide packet capture
- **Protocol filtering**: IPv4, IPv6, ICMP, BGP, or all packets
- **Robust process management**: Capture tracking across API route reloads

## 📋 Prerequisites

### Windows

- **Administrator privileges** (required for packet capture)
- [Npcap](https://npcap.com/) runtime (with WinPcap compatibility mode)
- [Npcap SDK 1.13+](https://npcap.com/#download) for building
- Visual Studio 2019+ or MinGW with C++17
- CMake 3.15+
- Node.js 16+ and npm

### Linux

- libpcap-dev
- CMake 3.15+
- Node.js 16+ and npm
- sudo privileges for packet capture

## 🚀 Quick Start

### Option A: One-Click Setup (Windows)

**Easiest way to get started!**

1. **Run setup script** (builds backend + installs dependencies):

   ```batch
   setup.bat
   ```

2. **Start the application** (run as Administrator):

   ```batch
   start.bat
   ```

   Or right-click `start.bat` → "Run as administrator"

3. **Open browser**: http://localhost:3000

### Option B: Manual Setup

#### 1. Build the C++ Backend

```bash
# Navigate to project root
cd Network-Dataset-Generator-web-app

# Create build directory
mkdir build
cd build

# Configure CMake (Windows with Npcap SDK)
cmake .. -DPCAP_INCLUDE_DIR="C:/path/to/npcap-sdk/Include" \
         -DPCAP_LIBRARY="C:/path/to/npcap-sdk/Lib/x64/wpcap.lib" \
         -DPACKET_LIBRARY="C:/path/to/npcap-sdk/Lib/x64/Packet.lib" \
         -A x64

# Build Release version
cmake --build . --config Release

# Executable: build/Release/NetworkPacketAnalyzer.exe
```

#### 2. Start the Web Frontend

```bash
# Navigate to web directory
cd web

# Install dependencies (first time only)
npm install

# Start dev server (AS ADMINISTRATOR on Windows)
npm run dev

# Open http://localhost:3000
```

### 3. Capture Network Traffic

1. **Select Interface**: Choose your active adapter (WiFi/Ethernet) from dropdown

   - ✓ [Recommended] = UP and has addresses
   - Or use "Auto-select" for automatic detection

2. **Configure Options**:

   - **Output filename**: `packet_capture.csv` (default)
   - **Filter**: IPv4, IPv6, Both, ICMP, or BGP
   - **Duration**: Seconds (0 = unlimited until you click Stop)
   - **Promiscuous mode**: Enable to capture all network traffic

3. **Start & Stop**:
   - Click **🚀 Start Capture**
   - For unlimited captures, click **🛑 Stop Capture** when done
   - Click **📥 Download CSV File** to get results

## 🖥️ CLI Usage (Backend Standalone)

The C++ sniffer can run independently from the command line:

```bash
# API format: <output> <interface> <filter> <duration> [promiscuous]
NetworkPacketAnalyzer.exe capture.csv auto both 30 on

# Arguments:
#   output      - CSV filename
#   interface   - "auto" or device path (e.g., "\Device\NPF_{...}")
#   filter      - "both" | "ipv4" | "ipv6" | "icmp" | "bgp"
#   duration    - seconds (0 = unlimited, Ctrl+C to stop)
#   promiscuous - "on" | "off" (default: on)

# Examples:
NetworkPacketAnalyzer.exe packets.csv auto ipv4 60 on
NetworkPacketAnalyzer.exe bgp_data.csv auto bgp 0 off
NetworkPacketAnalyzer.exe icmp.csv auto icmp 120 on

# List interfaces (JSON output for API)
NetworkPacketAnalyzer.exe --list-interfaces

# Interactive mode (prompts for all options)
NetworkPacketAnalyzer.exe
```

## CSV Output Format

The application outputs a CSV file with the following columns:

| Column           | Description             | IPv4 | IPv6 |
| ---------------- | ----------------------- | ---- | ---- |
| Timestamp        | Packet capture time     | ✓    | ✓    |
| Version          | IP version (4 or 6)     | ✓    | ✓    |
| IHL              | Internet Header Length  | ✓    | -    |
| TOS              | Type of Service         | ✓    | -    |
| TotalLength      | Total packet length     | ✓    | -    |
| Identification   | Fragment identification | ✓    | -    |
| Flags            | IP flags                | ✓    | -    |
| FragmentOffset   | Fragment offset         | ✓    | -    |
| TTL              | Time to Live            | ✓    | -    |
| Protocol         | Next protocol           | ✓    | -    |
| HeaderChecksum   | Header checksum         | ✓    | -    |
| SrcIP            | Source IP address       | ✓    | ✓    |
| DstIP            | Destination IP address  | ✓    | ✓    |
| OptionsHex       | IPv4 options (hex)      | ✓    | -    |
| TrafficClass     | Traffic class           | -    | ✓    |
| FlowLabel        | Flow label              | -    | ✓    |
| PayloadLength    | Payload length          | -    | ✓    |
| NextHeader       | Next header type        | -    | ✓    |
| HopLimit         | Hop limit               | -    | ✓    |
| ExtensionHeaders | Extension headers       | -    | ✓    |

## Architecture

- **PacketCapturer**: Handles low-level packet capture using pcap
- **PacketHandler**: Parses IP headers and extracts fields
- **PacketFeature**: Data structures for IPv4/IPv6 packet information
- **DatasetWriter**: Manages CSV output formatting and file operations

## Signal Handling

The application gracefully handles interruption signals:

- **Ctrl+C** (SIGINT): Stops capture and saves data
- **Ctrl+Break** (Windows): Alternative stop signal

## Performance Notes

- Processes packets in real-time with minimal buffering
- Progress indicators show packet count, rate, and IP addresses every 5 packets
- Milestone logs every 100 packets
- Automatic CSV escaping for special characters
- Memory-efficient parsing without payload copying

## Troubleshooting

### No Packets Captured (0 packets)

**Most Common Causes:**

1. **Not Running as Administrator**
   - Windows: Right-click VS Code/Terminal → "Run as Administrator"
   - Linux: Use `sudo` when running the sniffer
2. **Wrong Network Interface Selected**
   - Use the web interface dropdown to select the correct interface
   - Choose your active WiFi or Ethernet adapter (marked ✓ [Recommended])
   - Avoid WAN Miniport or virtual adapters
3. **No Network Traffic**
   - Generate traffic while capturing: browse web, ping, download files
   - Run: `ping google.com -n 50` in another terminal
4. **Npcap Issues**
   - Check service is running: `sc query npcap`
   - Reinstall Npcap with "WinPcap Compatible Mode" enabled
   - Restart computer after installing Npcap

**Test Script:**

```bash
# Run this to test capture with generated traffic
cd assets/Network-Dataset-Generator
test_with_traffic.bat
```

See `TROUBLESHOOTING.md` and `WHY_NO_PACKETS.md` for detailed debugging steps.

### CSV File Empty

- Same as "No Packets Captured" above
- Check that the interface has network activity
- Try selecting a different interface from the dropdown
- Verify Npcap service is running

### Web Interface Not Loading

```bash
# Make sure you're in the web directory
cd web

# Check if node_modules exists
ls node_modules

# If not, reinstall dependencies
npm install

# Restart dev server
npm run dev
```

### Interface Dropdown Empty

- Web server couldn't spawn the C++ executable
- Check that `NetworkPacketAnalyzer.exe` exists in `build/Release/`
- Rebuild the C++ project if needed

## 📁 Project Structure

```text
Network-Dataset-Generator-web-app/
├── setup.bat                   # One-click setup script (Windows)
├── start.bat                   # Quick start script (Windows)
├── CMakeLists.txt              # C++ build configuration
├── README.md                   # Main documentation
├── CHANGES.md                  # Recent improvements log
│
├── build/                      # CMake build output
│   └── Release/
│       └── NetworkPacketAnalyzer.exe
│
├── include/                    # C++ header files
│   ├── DatasetWriter.h         # CSV file writing
│   ├── PacketCapturer.h        # pcap interface wrapper
│   ├── PacketFeature.h         # Packet data structures
│   └── PacketParser.h          # IP header parsing
│
├── src/                        # C++ source files
│   ├── main.cpp                # CLI entry point with duration timer
│   ├── DatasetWriter.cpp       # CSV formatting and I/O
│   ├── PacketCapturer.cpp      # pcap capture loop
│   └── PacketParser.cpp        # IP header extraction
│
└── web/                        # Next.js frontend
    ├── package.json            # npm dependencies
    ├── next.config.js          # Next.js config
    ├── tsconfig.json           # TypeScript config
    │
    ├── lib/
    │   └── captureStore.ts     # Process tracking for Stop button
    │
    ├── pages/
    │   ├── _app.tsx            # App wrapper
    │   ├── index.tsx           # Main UI with Stop/Download buttons
    │   └── api/
    │       ├── capture.ts      # Start capture endpoint
    │       ├── stop-capture.ts # Stop capture endpoint
    │       └── interfaces.ts   # List interfaces endpoint
    │
    ├── styles/
    │   └── globals.css         # Global styles
    │
    ├── public/                 # Static files & CSV output
    │   ├── .captures.json      # Active capture registry (runtime)
    │   └── *.csv               # Generated capture files
    │
    └── node_modules/           # Dependencies (gitignored)
```

## 🌐 API Endpoints

### POST /api/capture

Start a packet capture session. Returns a JSON response with the CSV file URL when capture completes.

**Request Body:**

```json
{
  "output": "packet_capture.csv",
  "iface": "", // empty or "auto" for auto-select
  "filter": "both", // "both" | "ipv4" | "ipv6" | "icmp" | "bgp"
  "duration": 10, // seconds (0 = unlimited)
  "promiscuous": "on" // "on" | "off"
}
```

**Response:**

```json
{
  "success": true,
  "message": "/packet_capture.csv"
}
```

### POST /api/stop-capture

Stop an active unlimited-duration capture.

**Request Body:**

```json
{
  "output": "packet_capture.csv" // Matches the output filename from /api/capture
}
```

**Response:**

```json
{
  "success": true,
  "message": "Stopped capture for packet_capture.csv"
}
```

### GET /api/interfaces

List available network interfaces with status information.

**Response:**

```json
{
  "success": true,
  "interfaces": [
    {
      "id": "\\Device\\NPF_{...}",
      "name": "NPF_{...}",
      "description": "Intel(R) Wi-Fi 6 AX200 160MHz",
      "isUp": true,
      "hasAddresses": true,
      "isLoopback": false
    }
  ]
}
```
