const http = require('http');

const body = JSON.stringify({
  characterId: 'cmqsiy2b00035afvcv3thdjob',
  worldCalendar: null,
  previousWorldLegacies: [],
});

const startTime = Date.now();
let firstChunkTime = null;
let totalBytes = 0;
let eventCount = 0;
let narrativeDeltas = 0;
let lastNarrativeLen = 0;

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/game/advance-sse',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'Content-Length': Buffer.byteLength(body),
  },
}, (res) => {
  console.log(`[STATUS] ${res.statusCode}`);
  console.log(`[HEADERS]`, JSON.stringify(res.headers, null, 2));

  res.on('data', (chunk) => {
    if (firstChunkTime === null) {
      firstChunkTime = Date.now();
      console.log(`[FIRST CHUNK] arrived after ${firstChunkTime - startTime}ms, size: ${chunk.length} bytes`);
      console.log(`[FIRST CHUNK CONTENT]`, chunk.toString().slice(0, 500));
    }
    totalBytes += chunk.length;
    const str = chunk.toString();
    const events = (str.match(/event: /g) || []).length;
    eventCount += events;
    if (str.includes('narrative_delta')) {
      narrativeDeltas++;
      // 累加 narrative 长度
      const matches = str.match(/"delta":"([^"]*)"/g) || [];
      matches.forEach(m => {
        try {
          lastNarrativeLen += JSON.parse('{' + m + '}').delta.length;
        } catch {}
      });
      if (narrativeDeltas <= 3 || narrativeDeltas % 10 === 0) {
        console.log(`[NARRATIVE_DELTA #${narrativeDeltas}] narrative length so far: ${lastNarrativeLen}`);
      }
    }
    if (str.includes('event: done')) {
      console.log(`[DONE EVENT] found, elapsed: ${Date.now() - startTime}ms`);
    }
  });

  res.on('end', () => {
    console.log(`[END] total: ${totalBytes} bytes, ${eventCount} events, ${narrativeDeltas} deltas, narrative length: ${lastNarrativeLen}, elapsed: ${Date.now() - startTime}ms`);
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

req.write(body);
req.end();

setTimeout(() => {
  console.log(`[TIMEOUT] exit`);
  process.exit(2);
}, 100000);
