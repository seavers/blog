#!/usr/bin/env node
/**
 * 本地预览：模拟线上 nginx 的路径映射
 *   /        → _deploy/home/index.html
 *   /blog/*  → _deploy/*
 * 用法：npm run build && npm run serve   （默认端口 4000，可用 PORT 覆盖）
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '_deploy');
const PORT = Number(process.env.PORT || 4000);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/home/index.html';
  else if (p === '/blog' ) { res.writeHead(301, { Location: '/blog/' }); return res.end(); }
  else if (p.startsWith('/blog/')) p = p.slice(5);
  else { res.writeHead(404); return res.end('not found (only / and /blog/ are served locally)'); }
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`[serve] http://localhost:${PORT}/`));
