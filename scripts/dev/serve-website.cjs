/* Local-only preview for the standalone static website. */
"use strict";
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../../apps/website");
const index = process.argv.indexOf("--port"),
  port = index >= 0 ? Number(process.argv[index + 1]) : 4175;
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("Invalid port");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".mp4": "video/mp4",
  ".vtt": "text/vtt; charset=utf-8",
};
const server = http.createServer((req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
  } catch {
    res.writeHead(400).end();
    return;
  }
  const file = path.resolve(
    root,
    "." + pathname + (pathname.endsWith("/") ? "index.html" : ""),
  );
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile() || !types[path.extname(file)]) {
      res.writeHead(404).end("Not found");
      return;
    }
    const headers = {
      "Content-Type": types[path.extname(file)],
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };
    let start = 0,
      end = stat.size - 1,
      status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end();
        return;
      }
      if (!match[1]) {
        start = Math.max(0, stat.size - Number(match[2]));
      } else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= stat.size
      ) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end();
        return;
      }
      status = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
      headers["Content-Length"] = end - start + 1;
    }
    res.writeHead(status, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = fs.createReadStream(file, { start, end });
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  });
});
server.listen(port, "127.0.0.1", () =>
  process.stdout.write(`Glauka preview: http://127.0.0.1:${port}\n`),
);
