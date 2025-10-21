# Troubleshooting: No Packets Being Captured

If you're seeing "Total packets captured: 0" in your capture logs, here are the most common causes and solutions:

## 1. **Administrator Privileges Required** ⚠️

Packet capture requires administrator/elevated privileges on Windows.

**Solution:**
- Right-click VS Code → "Run as Administrator"
- OR: Right-click `NetworkPacketAnalyzer.exe` → "Run as Administrator"
- OR: Right-click your terminal → "Run as Administrator"

## 2. **No Network Traffic During Capture**

If your network interface is idle, nothing will be captured.

**Solution:**
- During capture, browse websites, download files, or run: `ping google.com`
- Use the test script: `test_with_traffic.bat` (automatically generates traffic)
- Try a longer duration (e.g., 30-60 seconds) to ensure you capture some traffic

## 3. **Npcap Service Not Running**

Check if the Npcap driver service is running:

```bash
sc query npcap
```

**Expected output:**
```
STATE              : 4  RUNNING
```

**If not running:**
```bash
# Start the service (requires admin)
sc start npcap
```

## 4. **Npcap Installation Issues**

Npcap must be installed in "WinPcap Compatible Mode" for this application.

**Solution:**
- Uninstall Npcap
- Download latest from: https://npcap.com/#download
- During installation, check:
  - ✅ "Install Npcap in WinPcap API-compatible Mode"
  - ✅ "Support loopback traffic capture"
- Restart computer after installation

## 5. **Wrong Network Interface Selected**

The auto-selection might pick an inactive interface.

**Solution:**
- Check available interfaces when the app starts
- Manually specify the interface in the web UI:
  - Find your active interface (e.g., `\Device\NPF_{...}` for your WiFi/Ethernet)
  - Copy and paste it into the "Interface" field

**Example interfaces:**
- WiFi: `\Device\NPF_{1CD5C5D1-7069-4D35-B8F7-74584B29057D}`
- Ethernet: `\Device\NPF_{52C3A213-FAAB-4AA7-B1DD-9D1E3D27E6F0}`

## 6. **Firewall or VPN Blocking**

Some firewalls or VPNs can interfere with packet capture.

**Solution:**
- Temporarily disable Windows Firewall
- Disconnect from VPN
- Add Npcap to firewall whitelist

## Quick Test

Run this from an **Administrator Command Prompt**:

```bash
cd "C:\Users\shish\Documents\main projects\network-dataset-fullstack\assets\Network-Dataset-Generator"
test_with_traffic.bat
```

This will:
1. Start capture
2. Generate traffic by pinging Google
3. Show you the captured packets

## Checking Logs

When running from the web app, check the terminal where `npm run dev` is running. You'll see logs like:

```
[SNIFFER] Total packets captured: 0       ← Problem!
[SNIFFER] Total packets captured: 142     ← Working!
```

## Still Not Working?

1. **Restart VS Code as Administrator**
2. **Restart Npcap service:** `sc stop npcap && sc start npcap`
3. **Reinstall Npcap** with WinPcap compatibility mode
4. **Check Npcap version:** Must be 1.0+ (you have 1.15, which is good!)
5. **Try a different interface** - manually specify Ethernet or WiFi interface

## Verification Commands

```bash
# Check Npcap service status
sc query npcap

# List network interfaces with pcap info
ipconfig /all

# Test basic connectivity
ping google.com -n 5

# Run sniffer manually as admin
cd build\Release
NetworkPacketAnalyzer.exe test.csv auto both 10
```

---

**TL;DR:** Run VS Code as Administrator and generate some network traffic (browse web, ping, download) during capture! 🚀
