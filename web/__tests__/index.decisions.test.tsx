import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, beforeEach, vi, expect } from "vitest";
import Home from "../pages/index";

global.fetch = vi.fn();

describe("Home decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, interfaces: [] }),
    });
  });

  it("allows toggling promiscuous mode", async () => {
    render(<Home />);
    const checkbox = screen.getByLabelText(/promiscuous mode/i);
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("unchecking all filters shows validation error", async () => {
    render(<Home />);
    const checkboxes = screen.getAllByRole("checkbox");
    // Uncheck IPv4 and IPv6
    await userEvent.click(checkboxes[0]);
    await userEvent.click(checkboxes[1]);
    const start = screen.getByRole("button", { name: /start capture/i });
    await userEvent.click(start);
    await waitFor(() => {
      expect(
        screen.getByText(/select at least one packet type/i)
      ).toBeInTheDocument();
    });
  });

  it("clicking Unlimited shows Stop Capture and calls stop API", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, interfaces: [] }),
      }) // interfaces
      .mockResolvedValueOnce(new Promise(() => {})); // start capture pending to show Capturing
    render(<Home />);
    const unlimitedBtn = screen.getByRole("button", { name: /unlimited/i });
    await userEvent.click(unlimitedBtn);
    const start = screen.getByRole("button", { name: /start capture/i });
    await userEvent.click(start);

    // Now Stop Capture should appear
    await waitFor(() => {
      expect(screen.getByText(/stop capture/i)).toBeInTheDocument();
    });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: "ok" }),
    });
    const stop = screen.getByRole("button", { name: /stop capture/i });
    await userEvent.click(stop);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/stop-capture",
        expect.anything()
      );
    });
  });

  it("Refresh Interfaces button triggers fetch", async () => {
    render(<Home />);
    // Wait until loading finishes so the refresh button is shown
    await waitFor(() =>
      expect(screen.queryByText(/loading interfaces/i)).not.toBeInTheDocument()
    );
    const refresh = screen.getByRole("button", { name: /refresh interfaces/i });
    await userEvent.click(refresh);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/interfaces");
    });
  });
});
