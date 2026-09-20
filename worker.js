const WISP_SERVERS = {
  "us-east-1": { url: "wss://wisp-us-east-1.cgamz.online", location: "Virginia, USA" },
  "us-east-2": { url: "wss://wisp-us-east-2.cgamz.online", location: "Ohio, USA" },
  "us-west":   { url: "wss://wisp-us-west.cgamz.online",   location: "Oregon, USA" },
  "europe":    { url: "wss://wisp-europe.cgamz.online",    location: "Frankfurt, Germany" },
  "asia":      { url: "wss://wisp-asia.cgamz.online",      location: "Singapore" },
};

const DEFAULT_SERVER = "us-east-1";

const WORKER_URLS = [
  "wss://wisp.cgamz.online",
  "wss://wisp.craftedgamz.com",
  "wss://wisp.cgamz.site",
  "wss://wisp.craftedgamz.workers.dev",
];

function isLocalOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname, port } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

async function pingServer(name, data) {
  const start = Date.now();
  try {
    const httpUrl = data.url.replace("wss://", "https://").replace("ws://", "http://").replace(/\/$/, "");
    const res = await fetch(httpUrl, { method: "GET", signal: AbortSignal.timeout(4000) });
    const latency = Date.now() - start;
    return { name, location: data.location, status: res.status, latency };
  } catch (e) {
    return { name, location: data.location, status: "unreachable", latency: null };
  }
}

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    const key = parts[0] || DEFAULT_SERVER;
    const serverData = WISP_SERVERS[key];

    const origin = req.headers.get("Origin") || "";
    const corsOrigin = isLocalOrigin(origin) ? origin : "*";

    // Handle preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Upgrade, Connection, Content-Type",
          "Access-Control-Allow-Credentials": isLocalOrigin(origin) ? "true" : "false",
          "Access-Control-Max-Age": "86400",
        }
      });
    }

    if (req.headers.get("Upgrade") === "websocket") {
      if (!serverData) {
        return new Response(`Unknown server: ${key}. Valid: ${Object.keys(WISP_SERVERS).join(", ")}`, { status: 400 });
      }

      return new Response(JSON.stringify({ redirect: serverData.url }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Wisp-Redirect": serverData.url,
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": isLocalOrigin(origin) ? "true" : "false",
          "Access-Control-Expose-Headers": "X-Wisp-Redirect",
        }
      });
    }

    const results = await Promise.all(
      Object.entries(WISP_SERVERS).map(([name, data]) => pingServer(name, data))
    );

    const rows = results.map(r => {
      const operational = r.status === 200;
      const label = operational ? "Operational" : "Unreachable";
      const dot = operational ? "#22c55e" : "#ef4444";
      const latency = r.latency !== null ? `${r.latency}ms` : "--";
      return `
        <div class="row">
          <span class="dot" style="background:${dot}"></span>
          <div class="row-info">
            <span class="name">${r.name}</span>
            <span class="location">${r.location}</span>
          </div>
          <span class="status" style="color:${dot}">${label}</span>
          <span class="latency">${latency}</span>
        </div>`;
    }).join("");

    const fullUrls = WORKER_URLS.map(u => {
      const host = u.replace("wss://", "");
      return Object.keys(WISP_SERVERS).map(k =>
        `<span style="color:#6ea8d4">wss:</span><span style="color:#e89eb8">//</span><span style="color:#7dd3a8">${host}</span><span style="color:#e89eb8">/</span><span style="color:#f4a261">${k}</span><span style="color:#e89eb8">/</span>`
      ).join("\n");
    }).join("\n\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Crafted Global Wisp Servers</title>
<script src="https://cdn.cgamz.online/brand.js" defer></script>
<link rel="icon" href="https://cdn.cgamz.online/favicon.png">
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #000; color: #fff; font-family: 'IBM Plex Mono', monospace; min-height: 100vh; display: flex; justify-content: center; padding: 48px 16px; }
  .wrap { width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 24px; }
  .card { background: #111; border: 1px solid #1e1e1e; border-radius: 12px; padding: 32px 36px; }
  .section-label { font-size: 11px; font-weight: 600; color: #fff; text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 20px; }
  h1 { font-size: 24px; font-weight: 600; margin-bottom: 24px; }
  .row { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid #181818; }
  .row:last-child { border-bottom: none; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .row-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .name { font-size: 13px; color: #fff; }
  .location { font-size: 11px; color: #b4b4b4; }
  .status { font-size: 12px; font-weight: 600; }
  .latency { font-size: 12px; color: #fff; min-width: 48px; text-align: right; }
  .code-block { background: #0d0d0d; border: 1px solid #1e1e1e; border-radius: 8px; padding: 16px 18px; font-size: 12px; line-height: 2; overflow-x: auto; white-space: pre; }
  .note { font-size: 11px; color: #aaa; margin-top: 14px; line-height: 1.7; }
  .note span { color: #fff; }
  .divider { border: none; border-top: 1px solid #1a1a1a; margin: 20px 0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>Crafted's Global Wisp Servers</h1>
    ${rows}
  </div>
<div class="card">
  <div class="section-label">How It Works</div>

  <div class="note" style="margin-bottom:14px;">
    This worker acts as a <span>global Wisp redirect router.</span><br>
    Connect to a worker URL with a region appended and it returns the proper backend Wisp server.
  </div>

  <div class="code-block">
<span style="color:#6ea8d4">wss:</span><span style="color:#e89eb8">//</span><span style="color:#7dd3a8">wisp.cgamz.online</span><span style="color:#e89eb8">/</span><span style="color:#f4a261">us-east-1</span><span style="color:#e89eb8">/</span>
<span style="color:#6ea8d4">wss:</span><span style="color:#e89eb8">//</span><span style="color:#7dd3a8">wisp.cgamz.online</span><span style="color:#e89eb8">/</span><span style="color:#f4a261">us-east-2</span><span style="color:#e89eb8">/</span>
<span style="color:#6ea8d4">wss:</span><span style="color:#e89eb8">//</span><span style="color:#7dd3a8">wisp.cgamz.online</span><span style="color:#e89eb8">/</span><span style="color:#f4a261">us-west</span><span style="color:#e89eb8">/</span>
<span style="color:#6ea8d4">wss:</span><span style="color:#e89eb8">//</span><span style="color:#7dd3a8">wisp.cgamz.online</span><span style="color:#e89eb8">/</span><span style="color:#f4a261">europe</span><span style="color:#e89eb8">/</span>
<span style="color:#6ea8d4">wss:</span><span style="color:#e89eb8">//</span><span style="color:#7dd3a8">wisp.cgamz.online</span><span style="color:#e89eb8">/</span><span style="color:#f4a261">asia</span><span style="color:#e89eb8">/</span>
  </div>

  <div class="note" style="margin-top:14px;">
    Omitting the region automatically uses the default server:
    <span style="color:#f4a261">${DEFAULT_SERVER}</span>
  </div>

  <hr class="divider">

  <div class="section-label">Available Worker Domains</div>

  <div class="code-block">
<span style="color:#6ea8d4">wss:</span><span style="color:#e89eb8">//</span><span style="color:#7dd3a8">wisp.cgamz.online</span>
<span style="color:#6ea8d4">wss:</span><span style="color:#e89eb8">//</span><span style="color:#7dd3a8">wisp.craftedgamz.com</span>
<span style="color:#6ea8d4">wss:</span><span style="color:#e89eb8">//</span><span style="color:#7dd3a8">wisp.cgamz.site</span>
<span style="color:#6ea8d4">wss:</span><span style="color:#e89eb8">//</span><span style="color:#7dd3a8">wisp.craftedgamz.workers.dev</span>
  </div>

  <hr class="divider">

  <div class="section-label">Backend Regions</div>

  <div class="code-block">
<span style="color:#f4a261">us-east-1</span>  <span style="color:#888">→</span> Virginia, USA
<span style="color:#f4a261">us-east-2</span>  <span style="color:#888">→</span> Ohio, USA
<span style="color:#f4a261">us-west</span>    <span style="color:#888">→</span> Oregon, USA
<span style="color:#f4a261">europe</span>     <span style="color:#888">→</span> Frankfurt, Germany
<span style="color:#f4a261">asia</span>       <span style="color:#888">→</span> Singapore
  </div>

  <hr class="divider">

  <div class="section-label">Example Response</div>

  <div class="note" style="margin-bottom:10px;">
    Connecting with a websocket upgrade returns a redirect target:
  </div>

  <div class="code-block">
<span style="color:#6ea8d4">GET</span> <span style="color:#7dd3a8">/wisp-server/</span>

{
  <span style="color:#9cdcfe">"redirect"</span>:
  <span style="color:#ce9178">"wss://wisp-server.example.com"</span>
}
  </div>

  <div class="note" style="margin-top:14px;">
    The redirect target is also exposed in the
    <span style="color:#9cdcfe">X-Wisp-Redirect</span> response header.
  </div>
</div>
  <div class="card">
  <div class="section-label">Usage Rules</div>
  <div class="note" style="margin-bottom:12px;">This Wisp infrastructure is provided for <span>testing and non-production use only.</span> Do not use it to serve live, production traffic.</div>
  <hr class="divider">
  <div class="note" style="margin-bottom:12px;"><span>Eclipse Suite members</span> have unlimited, unrestrained access with no additional restrictions.</div>
  <hr class="divider">
  <div class="note">Wisp protocol by <span>Mercury Workshop</span>, credit where it's due.</div>
  <hr class="divider">
  <div class="note"> &copy; 2026 Crafted Gamz, Eclipse Suite: All rights reserved (ARR).</div>
</div>
</div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": corsOrigin,
      }
    });
  }
};