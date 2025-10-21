# Empty CSV Troubleshooting Guide

## You're running as Administrator but still getting 0 packets? Here's why:

### Most Common Causes

#### 1. **Wrong Interface Selected** ✅ (FIXED!)

The auto-selection might be picking a virtual adapter instead of your actual network card.

**Solution - Now Easier:**
- Use the dropdown in the web UI to manually select your interface
- Look for interfaces marked with **✓ [Recommended]**
- Typical active interfaces:
  - `Intel(R) Wi-Fi 6 AX200 160MHz` - Your WiFi card
  - `Realtek PCIe GbE Family Controller` - Your Ethernet card
- **Avoid** these:
  - WAN Miniport (virtual adapters)
  - VPN adapters (unless capturing VPN traffic)
  - Bluetooth adapters

#### 2. **No Traffic on Selected Interface**

If you're on WiFi but capturing from Ethernet (or vice versa), you'll see 0 packets.

**Solution:**
- Check which interface you're actually using:
  ```cmd
  ipconfig
  # Look for the one with an IP address and "Default Gateway"
  ```
- Make sure to select that interface in the dropdown
- Generate traffic on that interface during capture

#### 3. **Promiscuous Mode Not Enabled**

Some WiFi adapters don't support promiscuous mode properly.

**Test:**
```bash
# Try capturing on a different interface
# Select your Ethernet adapter from the dropdown instead of WiFi
```

#### 4. **Npcap in Wrong Mode**

**Check:**
1. Open "Programs and Features" in Windows
2. Find "Npcap"
3. If it doesn't say "WinPcap API-compatible", reinstall:
   - Download: https://npcap.com/#download
   - Check ✅ "Install Npcap in WinPcap API-compatible Mode"
   - Restart computer

#### 5. **Still Nothing? Try This Test**

Run this test to verify which interface actually works:

```bash
# Open PowerShell AS ADMINISTRATOR
cd "C:\Users\shish\Documents\main projects\network-dataset-fullstack\assets\Network-Dataset-Generator\build\Release"

# Test WiFi adapter (adjust the device name)
./NetworkPacketAnalyzer.exe wifi_test.csv "\Device\NPF_{1CD5C5D1-7069-4D35-B8F7-74584B29057D}" both 30

# In another window, ping while it's running
ping google.com -t

# After 30 seconds, check wifi_test.csv
```

### Debugging Steps

1. **Identify your active adapter:**
   ```cmd
   ipconfig /all
   # Note the "Description" of the adapter with an IP and Default Gateway
   ```

2. **Match it in the web UI:**
   - Click "🔄 Refresh" to reload interfaces
   - Find your adapter in the dropdown (should match the Description from ipconfig)
   - Select it explicitly instead of using "Auto-select"

3. **Start capture with traffic:**
   ```cmd
   # In one window: start the web capture
   # In another window: generate traffic
   ping 8.8.8.8 -n 100
   ```

4. **Check the logs:**
   - Look at the terminal where `npm run dev` is running
   - You should see interface selection output
   - If it says "SELECTED as capture interface" for the wrong one, use the dropdown to pick the right one

### Expected Working Output

When it's working correctly with the right interface:

```
[SNIFFER] Available network interfaces:
  ...
  4. \Device\NPF_{1CD5C5D1-7069-4D35-B8F7-74584B29057D} (Intel(R) Wi-Fi 6 AX200 160MHz) [UP] [HAS_ADDRESSES]
  -> SELECTED as capture interface
[SNIFFER] Initialized packet capture on interface: \Device\NPF_{1CD5C5D1-7069-4D35-B8F7-74584B29057D}
[SNIFFER] Starting packet capture...
[1] IPv4 | 192.168.1.100 -> 8.8.8.8 | Size: 60 bytes | Rate: 5.0 pps | Total captured: 1
[2] IPv4 | 8.8.8.8 -> 192.168.1.100 | Size: 60 bytes | Rate: 5.0 pps | Total captured: 2
...
[SNIFFER] Total packets captured: 142  ← Success!
```

### Quick Checklist

- ✅ Running VS Code as Administrator
- ✅ Npcap service running (`sc query npcap`)
- ✅ **Selected the CORRECT interface in dropdown** (WiFi if using WiFi, Ethernet if using Ethernet)
- ✅ Generating traffic during capture (ping, browse, download)
- ✅ Capture duration long enough (30+ seconds recommended)

### If All Else Fails

Try capturing on the **loopback interface** with local traffic:

```bash
# In the web UI:
# 1. Select "Adapter for loopback traffic capture" from dropdown
# 2. Start capture for 30 seconds

# In another terminal:
ping localhost -n 100
# or
ping 127.0.0.1 -n 100
```

This should ALWAYS work and proves the sniffer itself is functional.

---

**TL;DR:** The interface dropdown now lets you manually select the right network adapter. Choose the one marked **✓ [Recommended]** that matches your active connection (WiFi or Ethernet), not virtual adapters! 🎯
