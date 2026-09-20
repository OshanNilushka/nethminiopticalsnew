// Dynamic API Base URL resolution for local network IP, Cloudflare tunnel & mobile access
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" &&
  (window.location.hostname.includes("trycloudflare.com") || window.location.protocol === "https:")
    ? "" // Uses the Vite HTTPS proxy to reach port 3000 without mixed-content errors
    : typeof window !== "undefined" &&
        window.location.hostname &&
        window.location.hostname !== "localhost" &&
        !window.location.hostname.includes("127.0.0.1")
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : "http://localhost:3000");

