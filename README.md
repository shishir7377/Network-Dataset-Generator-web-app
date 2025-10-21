# Network Packet Analyzer

A C++ application for capturing and analyzing IPv4 and IPv6 network packets using Npcap/WinPcap.

## Features

- Captures all IP packets (IPv4 + IPv6) from network interfaces
- Extracts every header field from IP packets
- Outputs structured CSV data with comprehensive packet information
- Cross-platform support (Windows with Npcap, Linux with libpcap)
- Real-time packet processing with minimal performance impact
## Requirements

### Windows
- [Npcap SDK](https://nmap.org/npcap/) installed
- Visual Studio 2019+ or MinGW with C++17 support
- CMake 3.15+

## Building

```bash
mkdir build
cd build
cmake ..
cmake --build . --config Release 
```

## Usage

```bash
# Basic usage - captures to packet_capture.csv
./NetworkPacketAnalyzer

# Specify output file
./NetworkPacketAnalyzer output.csv

# Specify output file and network interface
./NetworkPacketAnalyzer output.csv eth0
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
- Progress indicators every 100 packets
- Automatic CSV escaping for special characters
- Memory-efficient parsing without payload copying

## Error Handling

The application includes comprehensive error handling for:
- Network interface selection failures
- Packet capture errors
- File I/O operations
- Malformed packet detection
- Memory allocation issues
