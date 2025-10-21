import type { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

type Interface = {
  id: string
  name: string
  description: string
  isUp: boolean
  hasAddresses: boolean
  isLoopback: boolean
}

type Data = {
  success: boolean
  interfaces?: Interface[]
  message?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  console.log('[API /interfaces] Received request:', req.method)
  
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' })
    return
  }

  // Find the executable
  const repoRoot = path.resolve(process.cwd(), '..')
  const exeBase = 'NetworkPacketAnalyzer'
  const candidates = [
    path.join(repoRoot, 'build', 'Release', exeBase + '.exe'),
    path.join(repoRoot, 'build', exeBase),
  ]

  const exePath = candidates.find(p => fs.existsSync(p))
  if (!exePath) {
    console.log('[API /interfaces] ERROR: Executable not found')
    res.status(500).json({ success: false, message: 'Sniffer executable not found' })
    return
  }

  console.log('[API /interfaces] Found executable:', exePath)

  try {
    // Run the executable briefly to get interface list
    // We'll kill it quickly since we just need the interface list output
    const result = await new Promise<{ success: boolean; interfaces?: Interface[]; message?: string }>((resolve, reject) => {
      // Use a very short duration just to get interface list
      const child = spawn(exePath, ['temp.csv', 'auto', 'both', '1'], { windowsHide: true })

      let stdout = ''
      let stderr = ''
      let resolved = false
      
      child.stdout?.on('data', chunk => { 
        stdout += chunk.toString()
        console.log('[API /interfaces] stdout chunk:', chunk.toString())
        
        // Once we see "Starting packet capture", we have all the interface info
        if (stdout.includes('Starting packet capture') && !resolved) {
          resolved = true
          console.log('[API /interfaces] Detected capture start, killing process and parsing...')
          child.kill() // Kill the process early
          
          // Parse the interface list from stdout
          const interfaces: Interface[] = []
          const lines = stdout.split('\n')
          
          console.log('[API /interfaces] Parsing lines:', lines.length)
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim() // Remove \r and whitespace
            
            // Match lines like: "1. \Device\NPF_{...} (Intel Wi-Fi) [UP] [HAS_ADDRESSES]"
            // The line might start with spaces and a number followed by a dot
            const match = line.match(/^(\d+)\.\s+(.*)$/)
            if (match && match[2].includes('Device\\NPF_')) {
              const rest = match[2]
              
              // Extract device ID - it's already escaped as \\Device\\NPF_ in the string
              const deviceMatch = rest.match(/(\\Device\\NPF_\S+)/)
              if (!deviceMatch) continue
              
              const deviceId = deviceMatch[1]
              
              console.log('[API /interfaces] ✅ Matched line:', line)
              console.log('[API /interfaces] Found device:', deviceId)
              
              // Extract description from parentheses
              const descMatch = rest.match(/\(([^)]+)\)/)
              const description = descMatch ? descMatch[1] : 'Unknown Network Adapter'
              
              const isLoopback = rest.includes('LOOPBACK') || rest.toLowerCase().includes('loopback')
              const isUp = rest.includes('[UP]')
              const hasAddresses = rest.includes('[HAS_ADDRESSES]')
              
              console.log('[API /interfaces] Parsed:', { deviceId, description, isUp, hasAddresses, isLoopback })
              
              // Skip loopback interfaces
              if (!isLoopback) {
                interfaces.push({
                  id: deviceId,
                  name: deviceId.split('\\').pop() || deviceId,
                  description: description,
                  isUp: isUp,
                  hasAddresses: hasAddresses,
                  isLoopback: isLoopback
                })
                console.log('[API /interfaces] Added interface:', description)
              } else {
                console.log('[API /interfaces] Skipping loopback:', deviceId)
              }
            }
          }

          console.log('[API /interfaces] Total parsed interfaces:', interfaces.length)
          console.log('[API /interfaces] Interfaces:', JSON.stringify(interfaces, null, 2))
          
          if (interfaces.length === 0) {
            resolve({ success: false, message: 'No interfaces found' })
          } else {
            resolve({ success: true, interfaces })
          }
        }
      })
      
      child.stderr?.on('data', chunk => { 
        stderr += chunk.toString()
      })

      child.on('error', (err) => {
        if (!resolved) {
          console.error('[API /interfaces] Child process error:', err)
          reject({ success: false, message: 'Failed to list interfaces: ' + String(err) })
        }
      })

      child.on('close', (code) => {
        if (!resolved) {
          console.log('[API /interfaces] Process closed before interface list parsed')
          resolve({ success: false, message: 'Failed to parse interface list' })
        }
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          child.kill()
          resolve({ success: false, message: 'Timeout waiting for interface list' })
        }
      }, 5000)
    })

    res.status(200).json(result)
  } catch (err: any) {
    console.error('[API /interfaces] Catch block error:', err)
    res.status(500).json({ success: false, message: err.message || String(err) })
  }
}
