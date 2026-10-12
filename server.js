// Static file server + tiny JSON persistence API for the Team Trials Tracker.
// GET  /api/state  -> contents of data.json (404 if it doesn't exist yet)
// POST /api/state  -> overwrites data.json with the request body
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const PORT = process.env.PORT || 3001;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveStatic(req, res) {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, reqPath));
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'Forbidden');
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  });
}

function handleState(req, res) {
  if (req.method === 'GET') {
    fs.readFile(DATA_FILE, (err, data) => {
      if (err) return send(res, 404, '{}', { 'Content-Type': 'application/json' });
      send(res, 200, data, { 'Content-Type': 'application/json' });
    });
    return;
  }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5e6) req.destroy(); // guard against runaway uploads
    });
    req.on('end', () => {
      try {
        JSON.parse(body); // validate before touching disk
      } catch (e) {
        return send(res, 400, JSON.stringify({ ok: false, error: 'invalid json' }), { 'Content-Type': 'application/json' });
      }
      fs.writeFile(DATA_FILE, body, err => {
        if (err) return send(res, 500, JSON.stringify({ ok: false }), { 'Content-Type': 'application/json' });
        send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': 'application/json' });
      });
    });
    return;
  }
  send(res, 405, 'Method not allowed');
}

const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/api/state') return handleState(req, res);
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Team Trials Tracker running at http://localhost:${PORT}`);
  console.log(`Saving progress to ${DATA_FILE}`);
});
