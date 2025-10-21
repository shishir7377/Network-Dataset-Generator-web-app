import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '../pages/index'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

describe('Home Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, interfaces: [] }),
    })
  })

  it('renders the main heading', () => {
    render(<Home />)
    expect(screen.getByText('Network Dataset Generator')).toBeInTheDocument()
  })

  it('renders the capture form', () => {
    render(<Home />)
    expect(screen.getAllByText(/interface/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/duration \(seconds/i)).toBeInTheDocument()
    expect(screen.getByText(/output filename/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start capture/i })).toBeInTheDocument()
  })

  it('fetches interfaces on mount', async () => {
    const mockInterfaces = [
      { id: 'eth0', description: 'Ethernet', isUp: true, hasAddresses: true, isLoopback: false },
      { id: 'wlan0', description: 'Wi-Fi', isUp: true, hasAddresses: true, isLoopback: false },
    ]
    
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, interfaces: mockInterfaces }),
    })

    render(<Home />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/interfaces')
    })
  })

  it('displays loading state while fetching interfaces', async () => {
    ;(global.fetch as any).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ success: true, interfaces: [] }),
      }), 100))
    )

    render(<Home />)
    
    expect(screen.getByText(/loading interfaces/i)).toBeInTheDocument()
  })

  it('populates interface dropdown after fetching', async () => {
    const mockInterfaces = [
      { id: 'eth0', description: 'Ethernet Adapter', isUp: true, hasAddresses: true, isLoopback: false },
      { id: 'lo', description: 'Loopback', isUp: true, hasAddresses: false, isLoopback: true },
    ]
    
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, interfaces: mockInterfaces }),
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/ethernet adapter/i)).toBeInTheDocument()
    })
  })

  it('validates duration input', async () => {
    render(<Home />)
    
    const durationInput = screen.getByDisplayValue('10') as HTMLInputElement
    await userEvent.clear(durationInput)
    await userEvent.type(durationInput, '30')
    
    expect(durationInput.value).toBe('30')
  })

  it('shows unlimited capture option when duration is 0', async () => {
    render(<Home />)
    
    const durationInput = screen.getByDisplayValue('10') as HTMLInputElement
    await userEvent.clear(durationInput)
    await userEvent.type(durationInput, '0')
    
    expect(durationInput.value).toBe('0')
  })

  it('updates filename input', async () => {
    render(<Home />)
    
    const filenameInput = screen.getByDisplayValue('packet_capture.csv') as HTMLInputElement
    await userEvent.clear(filenameInput)
    await userEvent.type(filenameInput, 'my_capture.csv')
    
    expect(filenameInput.value).toBe('my_capture.csv')
  })

  it('submits form with valid data', async () => {
    const mockInterfaces = [
      { id: 'eth0', description: 'Ethernet', isUp: true, hasAddresses: true, isLoopback: false },
    ]
    
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, interfaces: mockInterfaces }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          message: '/packet_capture.csv'
        }),
      })

    render(<Home />)

    // Wait for interfaces to load
    await waitFor(() => {
      expect(screen.getByText(/ethernet/i)).toBeInTheDocument()
    })

    // Select interface (first select is the interface dropdown, second is filter)
    const selects = screen.getAllByRole('combobox')
    const interfaceSelect = selects[0] // First select is the interface dropdown
    await userEvent.selectOptions(interfaceSelect, 'eth0')

    // Duration is already set to 10 by default

    // Submit form
    const submitButton = screen.getByRole('button', { name: /start capture/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/capture', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }))
    })
  })

  it('shows loading state during capture', async () => {
    let resolveCapture: any
    const capturePromise = new Promise(resolve => {
      resolveCapture = resolve
    })

    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, interfaces: [] }),
      })
      .mockImplementationOnce(() => capturePromise)

    render(<Home />)

    const submitButton = screen.getByRole('button', { name: /start capture/i })
    await userEvent.click(submitButton)

    // Check that "Capturing..." appears
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      const capturingButton = buttons.find(btn => btn.textContent?.includes('Capturing'))
      expect(capturingButton).toBeDefined()
    })

    // Resolve the promise to complete the test
    resolveCapture({
      ok: true,
      json: async () => ({ success: true, message: '/output.csv' }),
    })
  })

  it('displays success message after capture', async () => {
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, interfaces: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          message: '/packet_capture.csv'
        }),
      })

    render(<Home />)

    const submitButton = screen.getByRole('button', { name: /start capture/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/capture complete/i)).toBeInTheDocument()
    })
  })

  it('displays download button after successful capture', async () => {
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, interfaces: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          message: '/packet_capture.csv'
        }),
      })

    render(<Home />)

    const submitButton = screen.getByRole('button', { name: /start capture/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/download csv/i)).toBeInTheDocument()
    })
  })

  it('displays error message on capture failure', async () => {
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, interfaces: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ 
          success: false, 
          message: 'Failed to capture packets'
        }),
      })

    render(<Home />)

    const submitButton = screen.getByRole('button', { name: /start capture/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/failed to capture packets/i)).toBeInTheDocument()
    })
  })

  it('handles network error gracefully', async () => {
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, interfaces: [] }),
      })
      .mockRejectedValueOnce(new Error('Network error'))

    render(<Home />)

    const submitButton = screen.getByRole('button', { name: /start capture/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeInTheDocument()
    })
  })

  it('disables submit button during capture', async () => {
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, interfaces: [] }),
      })
      .mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, message: '/output.csv' }),
        }), 100))
      )

    render(<Home />)

    const submitButton = screen.getByRole('button', { name: /start capture/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      const capturingButton = buttons.find(btn => btn.textContent?.includes('Capturing'))
      expect(capturingButton).toBeDisabled()
    })
  })
})
