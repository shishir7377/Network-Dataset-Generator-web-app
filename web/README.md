# Network Dataset Generator - Web Frontend

> ⚠️ **Note**: This file is deprecated. Please see the main [README.md](../README.md) for complete documentation.

This folder contains a minimal Next.js frontend to control the local C++ packet sniffer.

Quickstart

1. Build the C++ sniffer (see root README in the C++ project). On Windows ensure Npcap is installed.

2. Install dependencies and run the Next.js app:

```bash
cd web
npm install
npm run dev
```

3. Open http://localhost:3000 and use the form to start a capture. The API will spawn the local sniffer executable and write the CSV into `web/public/` so it can be downloaded.

Notes and assumptions

- The API expects the sniffer executable to be built and placed in a location relative to the web folder; adjust `pages/api/capture.ts` if necessary.
- Running packet capture requires elevated privileges on many platforms. Run your terminal as Administrator on Windows.
