# Network Dataset Generator - Full Stack Application

A full-stack network packet capture and analysis tool with a C++ backend sniffer and Next.js web frontend.

## Features

### Backend (C++ Sniffer)
- Captures all IP packets (IPv4 + IPv6) from network interfaces
- Extracts every header field from IP packets
- Outputs structured CSV data with comprehensive packet information
- Real-time packet processing with CLI support
- Cross-platform support (Windows with Npcap, Linux with libpcap)

### Frontend (Next.js Web App)
- User-friendly web interface for packet capture
- Network interface selection via dropdown
- Filter options (IPv4, IPv6, ICMP, or both)
- Configurable capture duration
- Real-time capture status
- Direct CSV download from browser
- Auto-interface detection

## Requirements

### Windows
- **Administrator privileges** (required for packet capture)
- [Npcap](https://npcap.com/) runtime installed (with WinPcap compatibility mode)
- [Npcap SDK 1.13+](https://npcap.com/#download) for building
- Visual Studio 2019+ or MinGW with C++17 support
- CMake 3.15+
- Node.js 16+ and npm

### Linux
- libpcap-dev
- CMake 3.15+
- Node.js 16+ and npm
- sudo privileges for packet capture

## Quick Start

### 1. Build the C++ Sniffer

```bash
# Navigate to project directory
cd assets/Network-Dataset-Generator

# Create build directory
mkdir build
cd build

# Configure CMake (Windows with Npcap SDK)
cmake .. -DPCAP_INCLUDE_DIR="C:/path/to/npcap-sdk/Include" \
         -DPCAP_LIBRARY="C:/path/to/npcap-sdk/Lib/x64/wpcap.lib" \
         -DPACKET_LIBRARY="C:/path/to/npcap-sdk/Lib/x64/Packet.lib" \
         -A x64

# Build
cmake --build . --config Release

# Executable will be at: build/Release/NetworkPacketAnalyzer.exe
```

### 2. Install and Run the Web Frontend

```bash
# Navigate to web directory
cd ../web

# Install dependencies
npm install

# Start the development server (AS ADMINISTRATOR)
npm run dev

# Open browser to http://localhost:3000
```

### 3. Using the Web Interface

1. **Select Network Interface**: Choose from the dropdown (or use auto-select)
   - Look for your active adapter (WiFi or Ethernet)
   - Interfaces marked with ✓ [Recommended] are UP and have addresses
   
2. **Configure Capture**:
   - Output filename (default: `packet_capture.csv`)
   - Filter: IPv4 only, IPv6 only, ICMP only, or Both
   - Duration in seconds (0 = run until stopped)

3. **Start Capture**: Click "🚀 Start Capture"

4. **Download Results**: CSV file will auto-open and show download button

## CLI Usage (C++ Sniffer Standalone)

```bash
# Basic usage with auto-interface selection
./NetworkPacketAnalyzer output.csv auto both 30

# Arguments: [output_file] [interface] [filter] [duration_seconds]
# - output_file: CSV filename
# - interface: "auto" or specific device path like "\Device\NPF_{...}"
# - filter: "both" | "ipv4" | "ipv6" | "icmp"
# - duration: seconds to capture (0 = until Ctrl+C)

# Examples:
./NetworkPacketAnalyzer packets.csv auto ipv4 60
./NetworkPacketAnalyzer icmp_only.csv "\Device\NPF_{...}" icmp 120
```

## CSV Output Format

The application outputs a CSV file with the following columns:

| Column | Description | IPv4 | IPv6 |
|--------|-------------|------|------|
| Timestamp | Packet capture time | ✓ | ✓ |
| Version | IP version (4 or 6) | ✓ | ✓ |
| IHL | Internet Header Length | ✓ | - |
| TOS | Type of Service | ✓ | - |
| TotalLength | Total packet length | ✓ | - |
| Identification | Fragment identification | ✓ | - |
| Flags | IP flags | ✓ | - |
| FragmentOffset | Fragment offset | ✓ | - |
| TTL | Time to Live | ✓ | - |
| Protocol | Next protocol | ✓ | - |
| HeaderChecksum | Header checksum | ✓ | - |
| SrcIP | Source IP address | ✓ | ✓ |
| DstIP | Destination IP address | ✓ | ✓ |
| OptionsHex | IPv4 options (hex) | ✓ | - |
| TrafficClass | Traffic class | - | ✓ |
| FlowLabel | Flow label | - | ✓ |
| PayloadLength | Payload length | - | ✓ |
| NextHeader | Next header type | - | ✓ |
| HopLimit | Hop limit | - | ✓ |
| ExtensionHeaders | Extension headers | - | ✓ |

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

## Project Structure

```
Network-Dataset-Generator/
├── CMakeLists.txt              # C++ build configuration
├── README.md                   # This file
├── TROUBLESHOOTING.md          # Detailed debugging guide
├── WHY_NO_PACKETS.md          # Why packets aren't captured
├── EMPTY_CSV_DEBUG.md         # Empty CSV troubleshooting
├── .gitignore                  # Git ignore rules
│
├── include/                    # C++ header files
│   ├── DatasetWriter.h
│   ├── PacketCapturer.h
│   ├── PacketFeature.h
│   └── PacketParser.h
│
├── src/                        # C++ source files
│   ├── main.cpp               # CLI entry point
│   ├── DatasetWriter.cpp
│   ├── PacketCapturer.cpp
│   └── PacketParser.cpp
│
├── build/                      # CMake build output (gitignored)
│   └── Release/
│       └── NetworkPacketAnalyzer.exe
│
└── web/                        # Next.js frontend
    ├── package.json
    ├── next.config.js
    ├── tsconfig.json
    ├── pages/
    │   ├── _app.tsx           # App wrapper
    │   ├── index.tsx          # Main UI page
    │   └── api/
    │       ├── capture.ts     # Capture API endpoint
    │       └── interfaces.ts  # Interface list API
    ├── styles/
    │   └── globals.css        # Global styles
    ├── public/                # Static files & CSV output
    └── node_modules/          # Dependencies (gitignored)
```

## API Endpoints

### POST /api/capture
Start a packet capture session.

**Request Body:**
```json
{
  "output": "packet_capture.csv",
  "iface": "",  // empty for auto-select
  "filter": "both",  // "both" | "ipv4" | "ipv6" | "icmp"
  "duration": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "/packet_capture.csv"
}
```

### GET /api/interfaces
List available network interfaces.

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
