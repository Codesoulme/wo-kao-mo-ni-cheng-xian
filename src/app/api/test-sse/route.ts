// 最小 SSE 测试：每 200ms 推一个时间戳，不调 LLM
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let count = 0;
      const interval = setInterval(() => {
        try {
          count++;
          const msg = `event: tick\ndata: ${JSON.stringify({ count, time: Date.now() })}\n\n`;
          controller.enqueue(encoder.encode(msg));
          if (count >= 30) {
            clearInterval(interval);
            controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
            controller.close();
          }
        } catch (e) {
          clearInterval(interval);
        }
      }, 200);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}
