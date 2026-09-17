// 내 컴퓨터에서만 보는 미리보기 서버
// 실행: node scripts/serve.mjs  →  브라우저에서 http://localhost:8080/preview/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml'
};

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // 블로그스팟 테마 확인용: 홈(/)과 상세 페이지(/p/...)는 테마 미리보기 파일로 응답
  if (path === '/' || path === '/index.html' || path.startsWith('/p/')) path = '/.theme-preview/index.html';
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT) || /[\\/]\.(env|cache)/.test(file)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`✅ 미리보기: http://localhost:${PORT}/preview/`);
  console.log(`✅ 블로그 테마 확인: http://localhost:${PORT}/  (상세: /p/support-detail.html?id=지원금번호)`);
  console.log('   끝내려면 이 창에서 Ctrl + C');
});
