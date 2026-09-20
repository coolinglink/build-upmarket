const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MYFXBOOK_URL = 'https://r.jina.ai/http://https://www.myfxbook.com/members/buildupmarketfx/abu-issah/12211403';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

async function fetchMyfxbookPage() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(MYFXBOOK_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/plain, text/html, */*; q=0.8'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Myfxbook proxy responded with ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractAccountData(html) {
  const lower = html.toLowerCase();
  const nameMatch = html.match(/#\s*([A-Za-z][A-Za-z\s]+?)(?:\s*\||\s*<|\s*\()/);
  const balanceMatch = html.match(/balance:\s*\$?([0-9,]+\.[0-9]{2})/i);
  const equityMatch = html.match(/equity:\s*\$?([0-9,]+\.[0-9]{2})/i);
  const gainMatch = html.match(/gain\s*:?\s*\+?([0-9.]+%?)/i);
  const absGainMatch = html.match(/abs\. gain\s*:?\s*\+?([0-9.]+%?)/i);
  const drawdownMatch = html.match(/drawdown\s*:?\s*([0-9.]+%?)/i);
  const updatedMatch = html.match(/updated\s+([0-9]+\s+minutes?\s+ago|[A-Za-z]+\s+[0-9]+\s+[A-Za-z]+)/i);

  const parsed = {
    name: nameMatch ? nameMatch[1].trim() : 'Abu Issah',
    balance: balanceMatch ? Number(balanceMatch[1].replace(/,/g, '')) : 100000,
    equity: equityMatch ? Number(equityMatch[1].replace(/,/g, '')) : 100000,
    gain: gainMatch ? gainMatch[1].replace('%', '') : '0.00',
    absGain: absGainMatch ? absGainMatch[1].replace('%', '') : '0.00',
    drawdown: drawdownMatch ? drawdownMatch[1].replace('%', '') : '0.00',
    updated: updatedMatch ? updatedMatch[1] : 'just now',
    source: 'Myfxbook',
    hasData: lower.includes('abu issah') && (lower.includes('balance') || lower.includes('equity'))
  };

  return parsed;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/live-account') {
    try {
      const html = await fetchMyfxbookPage();
      const data = extractAccountData(html);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        name: 'Abu Issah',
        balance: 100000,
        equity: 100000,
        gain: '0.00',
        absGain: '0.00',
        drawdown: '0.00',
        updated: 'waiting for sync',
        source: 'Myfxbook',
        hasData: false,
        error: error.message
      }));
    }
    return;
  }

  let filePath = url.pathname === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, url.pathname);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Server error');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Build-Up Market FX live server running on http://localhost:${PORT}`);
});
