import { config } from "./config.js";

export class VlrClient {
  constructor(baseUrl = config.vlrApiBaseUrl) {
    this.baseUrl = baseUrl;
  }

  async get(path, params = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`VLR API ${response.status} for ${url.pathname}`);
      }
      const body = await response.json();
      if (body?.status && body.status !== "success") {
        throw new Error(`VLR API returned ${body.status} for ${url.pathname}`);
      }
      return body?.data ?? body;
    } finally {
      clearTimeout(timeout);
    }
  }
}
