#!/usr/bin/env node

import http from "node:http";
import path from "node:path";
import { promises as fs } from "fs";

import { server as wisp, logging, extensions } from "@mercuryworkshop/wisp-js/server";
import { createRequire } from "module";
import { Command } from "commander";

const package_json = createRequire(import.meta.url)("./../../package.json");
const version = package_json.version;
const region = process.env.LOCATION?.trim();

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

const server = http.createServer(async (req, res) => {
  let client_ip = req.socket.address().address;
  let real_ip = wisp.parse_real_ip(req.headers, client_ip);
  logging.info(`HTTP ${req.method} ${req.url} from ${real_ip}`);

  if (!opts.static) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });

    const ascii_art = `
              ___           __ _          _    ___
              / __|_ _ __ _ / _| |_ ___ __| |  / __|__ _ _ __  ___
             | (__| '_/ _' |  _|  _/ -_| _' | | (_ / _' | '  \| /
              \___|_| \__,_|_| |__|_|___|___|_,_|  \___\__,_|_|_|_/__|

      ┌══════════════════════════════════════════════════════════════════┐
      |    Version 15: © Crafted Gamz 2023-2027 All Rights Reserved.     |
      └══════════════════════════════════════════════════════════════════┘

                    ┌─────────────────────────────────┐
                    │   CRAFTED GAMZ: WISP LICENSE    │
                    └─────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────┐
 |This software and associated infrastructure ("the Software") is provided by |
 |                 Crafted Gamz under the following terms:                    |
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
 │ authorization from Crafted Gamz.                                           |
 └────────────────────────────────────────────────────────────────────────────┘

 ┌─ 3. ECLIPSE SUITE ─────────────────────────────────────────────────────────┐
 │ Members of the Eclipse Suite are granted unlimited, unrestrained access    |
 │ to the Software with no additional restrictions beyond applicable law.     |
 │ Eclipse Suite membership is determined solely by Crafted Gamz.             |
 └────────────────────────────────────────────────────────────────────────────┘

 ┌─ 4. THIRD-PARTY ACKNOWLEDGMENT ────────────────────────────────────────────┐
 │ This Software implements the Wisp protocol, developed by Mercury Workshop. |
 │ Credit is given to Mercury Workshop for their work on the Wisp protocol    |
 │ specification. This license does not supersede any rights held by          |
 │ Mercury Workshop over the Wisp protocol itself.                            |
 └────────────────────────────────────────────────────────────────────────────┘

 ┌─ 5. NO WARRANTY ───────────────────────────────────────────────────────────┐
 │ CRAFTED GAMZ MAKES NO REPRESENTATIONS AND EXTENDS NO WARRANTIES OF ANY     |
 │ KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES   |
 │ OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND VALIDITY OF      |
 │ PATENT RIGHTS CLAIMS, ISSUED OR PENDING.                                   |
 └────────────────────────────────────────────────────────────────────────────┘

 ┌─ 6. RESERVATION OF RIGHTS ─────────────────────────────────────────────────┐
 │ All rights not expressly granted herein are reserved by Crafted Gamz.      |
 │ Unauthorized reproduction, distribution, or commercial use of the          |
 │ Software is strictly prohibited.                                           |
 └────────────────────────────────────────────────────────────────────────────┘
`;

    res.end(
      region
        ? `Crafted's Wisp v${version} is online and serving the ${region} region.\n${ascii_art}`
        : `Crafted's Wisp v${version} is online.\n${ascii_art}`
    );

    return;
  }

  try {
    let parsed_url = new URL(req.url, "http://localhost/");
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