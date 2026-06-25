// 模拟浏览器 fetch 调用 test-sse，验证流式是否真的工作
const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/test-sse',
  method: 'GET',
  headers: {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
  }
}, (res) => {
  console.log(`[STATUS] ${res.statusCode}`);
  console.log(`[HEADERS]`, res.headers);

  let totalBytes = 0;
  let eventCount = 0;
  let firstChunkTime = null;
  const startTime = Date.now();

  res.on('data', (chunk) => {
    if (firstChunkTime === null) {
      firstChunkTime = Date.now();
      console.log(`[FIRST CHUNK] arrived after ${firstChunkTime - startTime}ms, size: ${chunk.length} bytes`);
      console.log(`[FIRST CHUNK CONTENT]`, chunk.toString().slice(0, 200));
    }
    totalBytes += chunk.length;
    eventCount += (chunk.toString().match(/event: /g) || []).length;
    if (eventCount <= 5 || eventCount % 10 === 0) {
      console.log(`[CHUNK ${eventCount}] +${chunk.length} bytes, total: ${totalBytes}, elapsed: ${Date.now() - startTime}ms`);
    }
  });

  res.on('end', () => {
    console.log(`[END] total: ${totalBytes} bytes, ${eventCount} events, elapsed: ${Date.now() - startTime}ms`);
    process.exit(0);
  });

  res.on('error', (e) => {
    console.log(`[ERROR]`, e.message);
    process.exit(1);
  });
});

req.on('error', (e) => {
  console.log(`[REQ ERROR]`, e.message);
  process.exit(1);
});

req.end();

// 5秒超时
setTimeout(() => {
  console.log(`[TIMEOUT] exit`);
  process.exit(2);
}, 8000);
