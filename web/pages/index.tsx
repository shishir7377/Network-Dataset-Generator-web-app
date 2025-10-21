'use client'
import { useState, useEffect } from 'react'

type Interface = {
  id: string
  name: string
  description: string
  isUp: boolean
  hasAddresses: boolean
  isLoopback: boolean
}

export default function Home() {
  const [iface, setIface] = useState('')
  const [output, setOutput] = useState('packet_capture.csv')
  const [filter, setFilter] = useState('both')
  const [duration, setDuration] = useState(10)
  const [status, setStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [interfaces, setInterfaces] = useState<Interface[]>([])
  const [loadingInterfaces, setLoadingInterfaces] = useState(false)

  // Fetch available interfaces on component mount
  useEffect(() => {
    fetchInterfaces()
  }, [])

  async function fetchInterfaces() {
    setLoadingInterfaces(true)
    console.log('[Frontend] Fetching interfaces...')
    try {
      const res = await fetch('/api/interfaces')
      console.log('[Frontend] Response status:', res.status)
      const data = await res.json()
      console.log('[Frontend] Response data:', data)
      if (data.success && data.interfaces) {
        setInterfaces(data.interfaces)
        console.log('[Frontend] Loaded interfaces:', data.interfaces)
      } else {
        console.error('[Frontend] Failed to load interfaces:', data.message)
        setInterfaces([]) // Set empty array on failure
      }
    } catch (err) {
      console.error('[Frontend] Error fetching interfaces:', err)
      setInterfaces([]) // Set empty array on error
    } finally {
      setLoadingInterfaces(false)
    }
  }

  async function startCapture(e: any) {
    e.preventDefault()
    setIsLoading(true)
    setStatus('Starting capture...')
    setDownloadUrl(null)
    
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output, iface, filter, duration })
      })
      const data = await res.json()
      if (data.success) {
        setStatus('✅ Capture complete!')
        setDownloadUrl(data.message)
        // Auto-open the file in new tab
        window.open(data.message, '_blank')
      } else {
        setStatus('❌ Error: ' + data.message)
      }
    } catch (err) {
      setStatus('❌ Request failed: ' + String(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Network Dataset Generator</h1>
      
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        color: 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>⚠️ Important Requirements</h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Run VS Code or your terminal <strong>as Administrator</strong> (required for packet capture)</li>
          <li>Generate network traffic during capture (browse web, ping google.com, download files)</li>
          <li>Ensure Npcap service is running: <code>sc query npcap</code></li>
        </ul>
      </div>

      <form onSubmit={startCapture}>
        <div>
          <label>Output filename: </label>
          <input value={output} onChange={e => setOutput(e.target.value)} />
        </div>
        <div>
          <label>Interface: </label>
          {loadingInterfaces ? (
            <span>⏳ Loading interfaces...</span>
          ) : (
            <>
              <select 
                value={iface} 
                onChange={e => setIface(e.target.value)}
                style={{ minWidth: '400px' }}
              >
                <option value="">🔄 Auto-select (recommended)</option>
                {interfaces.map(int => (
                  <option key={int.id} value={int.id}>
                    {int.description} 
                    {int.isUp && int.hasAddresses ? ' ✓ [Recommended]' : int.isUp ? ' ✓' : ' ⚠ (DOWN)'}
                  </option>
                ))}
              </select>
              <button 
                type="button" 
                onClick={fetchInterfaces}
                style={{ marginLeft: '10px', padding: '5px 10px', fontSize: '12px' }}
                disabled={loadingInterfaces}
              >
                🔄 Refresh
              </button>
            </>
          )}
          <br />
          <small style={{ color: '#666', fontSize: '12px' }}>
            💡 Tip: Choose your active network adapter (WiFi or Ethernet with ✓ [Recommended]). 
            Auto-select picks the first active interface.
          </small>
        </div>
        <div>
          <label>Filter: </label>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="both">Both (IPv4 + IPv6)</option>
            <option value="ipv4">IPv4 only</option>
            <option value="ipv6">IPv6 only</option>
            <option value="icmp">ICMP only</option>
          </select>
        </div>
        <div>
          <label>Duration (seconds, 0 = until stopped): </label>
          <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={isLoading}>
            {isLoading ? '⏳ Capturing...' : '🚀 Start Capture'}
          </button>
        </div>
      </form>
      
      {status && (
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <p style={{ fontSize: '18px', marginBottom: '15px' }}>{status}</p>
          {downloadUrl && (
            <a 
              href={downloadUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="button"
              style={{ display: 'inline-block', textDecoration: 'none' }}
            >
              📥 Download CSV File
            </a>
          )}
        </div>
      )}
    </main>
  )
}
