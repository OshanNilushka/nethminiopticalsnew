// Backend Azure production URL
export const AZURE_BACKEND_URL = "https://nethmini-core-backend-api-gaemekasc5f6hscv.centralindia-01.azurewebsites.net";

// Dynamic API Base URL resolution for local network IP, Cloudflare tunnel & production Vercel
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" &&
  (window.location.hostname.includes("vercel.app") ||
   (!window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1") && !window.location.hostname.includes("trycloudflare.com") && window.location.protocol === "https:"))
    ? AZURE_BACKEND_URL
    : typeof window !== "undefined" && window.location.hostname.includes("trycloudflare.com")
    ? "" // Uses the Vite proxy for Cloudflare tunnel
    : typeof window !== "undefined" &&
        window.location.hostname &&
        window.location.hostname !== "localhost" &&
        !window.location.hostname.includes("127.0.0.1")
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : "http://localhost:3000");

/**
 * Safely parse JSON response from fetch to avoid "Unexpected end of JSON input" errors
 */
export async function parseResponseData(response) {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return { error: `Server returned an invalid JSON response (HTTP ${response.status})` };
    }
  }
  const text = await response.text();
  return { error: text || `Request failed with HTTP status ${response.status} (${response.statusText})` };
}


