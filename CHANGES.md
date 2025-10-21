# Changelog

### Major Improvements

#### Accurate Duration Control

- **Fixed**: Duration timer now stops capture precisely at the specified time
- **Added**: Thread-based timer that terminates `pcap_loop` even on idle networks
- **Impact**: 2-second captures now complete in ~2 seconds (was 27+ seconds)

#### Stop Button for Unlimited Captures

- **Added**: UI Stop button for unlimited duration (duration = 0) captures
- **Added**: `/api/stop-capture` endpoint to terminate running captures
- **Added**: Process tracking across API route reloads via `captureStore.ts`
- **Removed**: Need to Ctrl+C in terminal to stop unlimited captures

#### On-Demand Downloads

- **Changed**: CSV files no longer auto-download/auto-open in new tab
- **Added**: Explicit "Download CSV File" button appears when capture completes
- **Impact**: User controls when to download, reducing unwanted tab openings

### Bug Fixes

#### Duration Handling

- **Fixed**: Duration parameter only checked inside packet callback, causing delays
- **Fixed**: `pcap_loop` wouldn't break until packets arrived on quiet networks
- **Solution**: Timer thread + callback both call `stopCapture()` when duration elapses

#### Process Management

- **Fixed**: Stop API couldn't terminate captures after hot-reload in dev mode
- **Solution**: Persist capture PIDs to `.captures.json` with fallback kill by PID
- **Added**: Cleanup of stale process registry on capture start/stop

#### API Timeout

- **Fixed**: Unlimited captures killed after 10 minutes by API safety timeout
- **Changed**: Extended safety timeout to 24 hours for unlimited duration
- **Changed**: Finite duration timeout is now `duration + 5s` (was `duration + 30s`)

### Technical Changes

#### Backend (C++)

- `src/main.cpp`:
  - Added timer thread for duration enforcement
  - Call `stopCapture()` from both timer and packet callback
  - Properly join timer thread on exit

#### Frontend (Next.js)

- `web/lib/captureStore.ts`:

  - New module to track active capture child processes
  - Registry persisted to `.captures.json` for hot-reload resilience
  - Functions: `registerCapture`, `stopCapture`, `stopByKeyWithFallback`

- `web/pages/api/capture.ts`:

  - Use `captureStore` to register/remove child processes
  - Return JSON with CSV URL (no auto-download)
  - Extended timeout for unlimited captures

- `web/pages/api/stop-capture.ts`:

  - Accept `{ output }` to stop specific capture by key
  - Use `stopByKeyWithFallback` for PID-based termination if needed

- `web/pages/index.tsx`:
  - Removed `window.open(data.message)` auto-download behavior
  - Added `isUnlimited` state tracking (duration === 0)
  - Added Stop Capture button (visible when `isUnlimited`)
  - Download button always requires explicit click
