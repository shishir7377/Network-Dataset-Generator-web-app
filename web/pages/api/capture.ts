import type { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

type Data = {
  success: boolean
  message?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  console.log('[API] Received request:', req.method, req.body)
  
  if (req.method !== 'POST') {
    console.log('[API] Method not allowed:', req.method)
    res.status(405).json({ success: false, message: 'Method not allowed' })
    return
  }

  const { output = 'packet_capture.csv', iface = '', filter = 'both', duration = 10 } = req.body
  console.log('[API] Parsed params:', { output, iface, filter, duration })

  // Determine repository root and executable candidates
  const repoRoot = path.resolve(process.cwd(), '..')
  console.log('[API] Repo root:', repoRoot)
  console.log('[API] Process cwd:', process.cwd())
  
  const exeBase = 'NetworkPacketAnalyzer'
  const candidates = [
    path.join(repoRoot, 'build', 'Release', exeBase + '.exe'),
    path.join(repoRoot, 'build', exeBase),
    path.join(repoRoot, 'build', 'Release', exeBase + '.exe'),
    path.join(repoRoot, exeBase + '.exe'),
    path.join(repoRoot, '..', exeBase + '.exe')
  ]

  console.log('[API] Searching for executable in candidates:')
  candidates.forEach(c => console.log('  -', c, fs.existsSync(c) ? '✓' : '✗'))

  const exePath = candidates.find(p => fs.existsSync(p))
  if (!exePath) {
    console.log('[API] ERROR: Executable not found in any candidate path')
    res.status(500).json({ success: false, message: 'Sniffer executable not found. Build the C++ project first.' })
    return
  }

  console.log('[API] Found executable:', exePath)

  // Ensure public directory exists
  const publicDir = path.join(process.cwd(), 'public')
  if (!fs.existsSync(publicDir)) {
    console.log('[API] Creating public directory:', publicDir)
    fs.mkdirSync(publicDir, { recursive: true })
  }

  const outPath = path.join(publicDir, output)
  console.log('[API] Output CSV path:', outPath)

  // If no interface specified, use a dummy value that triggers auto-selection
  // The C++ code will auto-select the first non-loopback interface with addresses
  const interfaceArg = iface || 'auto'
  console.log('[API] Interface arg:', interfaceArg)

  try {
    const args = [outPath, interfaceArg, filter || 'both', String(duration)]
    console.log('[API] Spawning sniffer with args:', args)
    
    // Wrap spawn in a Promise to properly await completion
    const result = await new Promise<{ success: boolean; message: string }>((resolve, reject) => {
      const child = spawn(exePath, args, { windowsHide: true })

      let stdout = ''
      let stderr = ''
      
      child.stdout?.on('data', chunk => { 
        const data = chunk.toString()
        stdout += data
        console.log('[SNIFFER]', data.trim())
      })
      
      child.stderr?.on('data', chunk => { 
        const data = chunk.toString()
        stderr += data
        console.error('[SNIFFER ERROR]', data.trim())
      })

      child.on('error', (err) => {
        console.error('[API] Child process error:', err)
        reject({ success: false, message: 'Failed to start sniffer: ' + String(err) })
      })

      child.on('close', (code) => {
        console.log('[API] Child process closed with code:', code)
        console.log('[API] Stdout:', stdout)
        console.log('[API] Stderr:', stderr)
        
        if (code !== 0) {
          console.error('[API] Sniffer exited with error code:', code)
          reject({ success: false, message: `Sniffer exited with code ${code}. ${stderr}` })
          return
        }

        if (!fs.existsSync(outPath)) {
          console.error('[API] Output file not found after capture:', outPath)
          reject({ success: false, message: 'Capture finished but output file not found.' })
          return
        }

        const fileSize = fs.statSync(outPath).size
        console.log('[API] Output file created successfully:', outPath, 'Size:', fileSize, 'bytes')
        
        const publicUrl = `/${output}`
        console.log('[API] Returning public URL:', publicUrl)
        resolve({ success: true, message: publicUrl })
      })
    })

    console.log('[API] Sending response:', result)
    res.status(200).json(result)
  } catch (err: any) {
    console.error('[API] Catch block error:', err)
    res.status(500).json({ success: false, message: err.message || String(err) })
  }
}
