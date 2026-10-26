#!/usr/bin/env node

import http from "node:http";
import path from "node:path";
import { promises as fs } from "fs";
import { fileURLToPath } from "node:url";

import { server as wisp, logging, extensions } from "@mercuryworkshop/wisp-js/server";
import { createRequire } from "module";
import { Command } from "commander";

import { landingPage } from "./landing.mjs";

const package_json = createRequire(import.meta.url)("./../../package.json");
const version = package_json.version;
const region = process.env.LOCATION?.trim();

// The brand artwork sits beside package.json. Resolving it from this module
// rather than process.cwd() keeps it working under any start directory.
const package_root = fileURLToPath(new URL("../..", import.meta.url));

const program = new Command();
program
  .name("wisp-js-server")
  .description(`A Wisp server implementation written in Javascript. (v${version})`)
  .version(version);

program
  .option("-H, --host <host>", "The hostname the server will listen on.", "127.0.0.1")
  .option("-P, --port <port>", "The port number to run the server on.", parseInt(process.env.PORT || "5001"))
  .option("-L, --logging <log_level>", "The log level to use. This is either DEBUG, INFO, WARN, ERROR, or NONE.", "INFO")
  .option("-S, --static <static_dir>", "The directory to serve static files from. (optional)")
  .option("-C, --config <config_path>", "The path to your Wisp server config file. This is the same format as `wisp.options` in the API. (optional)")
  .option("-O, --options <options_json>", "A JSON string to set the Wisp config without using a file. (optional)");

program.parse();
const opts = program.opts();

opts.logging = opts.logging.toUpperCase();
if (["DEBUG", "INFO", "WARN", "ERROR", "NONE"].includes(opts.logging)) {
  logging.set_level(logging[opts.logging]);
}
else {
  console.error("Invalid log level: " + opts.logging);
  console.error("Valid choices: DEBUG, INFO, WARN, ERROR, NONE");
  process.exit(1);
}

if (opts.static) {
  opts.static = path.resolve(opts.static);
  logging.info("Serving static files from: " + opts.static);
}

if (opts.config) {
  opts.config = path.resolve(opts.config);
  logging.info("Using config file: " + opts.config);

  let data = await fs.readFile(opts.config);
  let config = JSON.parse(data);
  for (let [key, value] of Object.entries(config))
    wisp.options[key] = value;
}

if (opts.options) {
  opts.options = JSON.parse(opts.options);
  for (let [key, value] of Object.entries(opts.options))
    wisp.options[key] = value;
}

const mime_types = {
  "ico": "image/x-icon",
  "html": "text/html",
  "js": "text/javascript",
  "mjs": "text/javascript",
  "json": "application/json",
  "css": "text/css",
  "png": "image/png",
  "jpg": "image/jpeg",
  "wav": "audio/wav",
  "mp3": "audio/mpeg",
  "svg": "image/svg+xml",
  "pdf": "application/pdf",
  "zip": "application/zip",
  "ttf": "application/x-font-ttf"
};

// Brand artwork for the index page, served from disk rather than inlined into
// the page: background.png alone is 414 KB.
const assets = {
  "/background.png": "background.png",
  "/logo.png": "logo.png",
  "/favicon.png": "favicon.png"
};

async function serve_asset(res, name) {
  try {
    let data = await fs.readFile(path.join(package_root, name));
    res.writeHead(200, {
      "Content-Type": mime_types.png,
      "Content-Length": data.length,
      "Cache-Control": "public, max-age=86400"
    });
    res.end(data);
  }

  catch (err) {
    logging.error(`Could not serve brand asset ${name}: ${err.message}`);
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 not found");
  }
}

async function can_read(target) {
  try {
    await fs.access(target);
    return true;
  }

  catch {
    return false;
  }
}

async function assets_present() {
  let checks = await Promise.all(
    Object.values(assets).map((name) => can_read(path.join(package_root, name)))
  );
  return checks.every(Boolean);
}

// One row per subsystem the index page claims to know about. The page itself
// only reads name/ok; detail is there for anyone curling /healthz directly.
async function serve_health(res) {
  let components = [
    { name: "http", ok: true, detail: `wisp-js v${version}` },
    { name: "wisp", ok: server.listening, detail: `protocol v${wisp.options.wisp_version}` },
    { name: "assets", ok: await assets_present(), detail: "brand artwork" }
  ];

  if (opts.static)
    components.push({ name: "static", ok: await can_read(opts.static), detail: "static directory" });

  let body = {
    status: components.every((c) => c.ok) ? "ok" : "degraded",
    version,
    region: region || null,
    components
  };

  res.writeHead(body.status === "ok" ? 200 : 503, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body, null, 2));
}

const server = http.createServer(async (req, res) => {
  let client_ip = req.socket.address().address;
  let real_ip = wisp.parse_real_ip(req.headers, client_ip);
  logging.info(`HTTP ${req.method} ${req.url} from ${real_ip}`);

  let parsed_url = new URL(req.url, "http://localhost/");
  let route = parsed_url.pathname;

  if (!opts.static) {
    // "/" carries the brand splash; below it are the only endpoints that page
    // asks for. /license keeps the notice the old plain-text root carried.
    if (route === "/" || route === "/index.html") {
      let html = landingPage();
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": Buffer.byteLength(html),
        "Cache-Control": "no-store"
      });
      res.end(html);
      return;
    }

    if (route === "/healthz") {
      await serve_health(res);
      return;
    }

    let brand_asset = assets[route];
    if (brand_asset) {
      await serve_asset(res, brand_asset);
      return;
    }

    if (route !== "/license") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 not found");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });

    const ascii_art = `
      ┌══════════════════════════════════════════════════════════════════┐
      |         © Plutonium Network 2026-2027 All Rights Reserved.       |
      └══════════════════════════════════════════════════════════════════┘

                    ┌─────────────────────────────────┐
                    │ Plutonium Network: WISP LICENSE │
                    └─────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────┐
 |This software and associated infrastructure ("the Software") is provided by |
 |                 Plutonium Network under the following terms:               |
 └────────────────────────────────────────────────────────────────────────────┘

 ┌─ 1. PERMITTED USE ─────────────────────────────────────────────────────────┐
 │ The Software is made available strictly for testing and non-production     |
 │ purposes. You may use, modify, and inspect the Software in development,    |
 │ staging, or experimental environments only.                                |
 └────────────────────────────────────────────────────────────────────────────┘

 ┌─ 2. RESTRICTIONS ──────────────────────────────────────────────────────────┐
 │ You may not use the Software to serve live, production traffic or in any   |
 │ environment where real end-users depend on it for active, operational      |
 │ services. Any such use is expressly prohibited without prior written       |
 │ authorization from Plutonium Network.                                      |
 └────────────────────────────────────────────────────────────────────────────┘

 ┌─ 3. THIRD-PARTY ACKNOWLEDGMENT ────────────────────────────────────────────┐
 │ This Software implements the Wisp protocol, developed by Mercury Workshop. |
 │ Credit is given to Mercury Workshop for their work on the Wisp protocol    |
 │ specification. This license does not supersede any rights held by          |
 │ Mercury Workshop over the Wisp protocol itself.                            |
 └────────────────────────────────────────────────────────────────────────────┘

 ┌─ 4. NO WARRANTY ───────────────────────────────────────────────────────────┐
 │ Plutonium Network MAKES NO REPRESENTATIONS AND EXTENDS NO WARRANTIES OF ANY|
 │ KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES   |
 │ OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND VALIDITY OF      |
 │ PATENT RIGHTS CLAIMS, ISSUED OR PENDING.                                   |
 └────────────────────────────────────────────────────────────────────────────┘

 ┌─ 5. RESERVATION OF RIGHTS ─────────────────────────────────────────────────┐
 │ All rights not expressly granted herein are reserved by Plutonium Network. |
 │ Unauthorized reproduction, distribution, or commercial use of the          |
 │ Software is strictly prohibited.                                           |
 └────────────────────────────────────────────────────────────────────────────┘
`;

    res.end(
      region
        ? `Plutonium Network's Wisp v${version} is online and serving the ${region} region.\n${ascii_art}`
        : `Plutonium Network's Wisp v${version} is online.\n${ascii_art}`
    );

    return;
  }

  try {
    let served_path = path.join(opts.static, parsed_url.pathname);

    let path_stat = await fs.stat(served_path);
    if (path_stat.isDirectory()) {
      served_path = path.join(served_path, "index.html");
    }

    let data = await fs.readFile(served_path);
    let file_ext = served_path.split(".").reverse()[0];
    let content_type = mime_types[file_ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": content_type });
    res.end(data);
  }

  catch (err) {
    if (err.code == "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 not found");
    }
    else {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("500 internal server error:\n" + err);
    }
  }
});

server.on("upgrade", (req, socket, head) => {
  wisp.routeRequest(req, socket, head);
});

server.on("listening", () => {
  logging.info(`HTTP server listening on ${opts.host}:${opts.port}`);
});

server.listen(parseInt(opts.port), opts.host);