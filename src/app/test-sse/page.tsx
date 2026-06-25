'use client';
import { useState } from 'react';

export default function TestSSE() {
  const [events, setEvents] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [mode, setMode] = useState<'fetch' | 'eventsource' | 'advance'>('fetch');

  const startFetch = async () => {
    setEvents([]);
    setStatus('starting');
    try {
      const res = await fetch('/api/test-sse');
      if (!res.body) {
        setStatus('no body');
        return;
      }
      setStatus('connected');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setStatus('done');
          break;
        }
        const text = decoder.decode(value, { stream: true });
        buffer += text;
        setStatus(`receiving: ${text.length} bytes`);
        const parts = buffer.split('\n\n');
        for (const part of parts) {
          if (part.trim()) {
            setEvents(prev => [...prev, part]);
          }
        }
        buffer = parts[parts.length - 1];
      }
    } catch (e: any) {
      setStatus(`error: ${e.message}`);
    }
  };

  const startEventSource = () => {
    setEvents([]);
    setStatus('starting');
    const es = new EventSource('/api/test-sse');
    es.onopen = () => setStatus('connected (ES)');
    es.onerror = (e) => {
      setStatus(`error: ${JSON.stringify(e)}`);
      es.close();
    };
    es.addEventListener('tick', (e: any) => {
      setStatus(`receiving tick`);
      setEvents(prev => [...prev, `tick: ${e.data}`]);
    });
    es.addEventListener('done', (e: any) => {
      setStatus('done');
      es.close();
    });
  };

  const start = () => {
    if (mode === 'fetch') startFetch();
    else if (mode === 'eventsource') startEventSource();
    else startAdvanceSSE();
  };

  const startAdvanceSSE = async () => {
    setEvents([]);
    setStatus('starting (POST advance-sse)');
    const startTime = Date.now();
    try {
      // 直接用硬编码的 characterId
      const charId = 'cmqsiy2b00035afvcv3thdjob';
      setStatus(`POST advance-sse for char ${charId} at ${Date.now() - startTime}ms`);

      const res = await fetch('/api/game/advance-sse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: charId }),
      });
      if (!res.body) {
        setStatus('no body');
        return;
      }
      setStatus(`connected at ${Date.now() - startTime}ms`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastEventTime = Date.now();
      while (true) {
        const { done, value } = await reader.read();
        const now = Date.now();
        if (done) {
          setStatus(`DONE after ${now - startTime}ms, ${events.length} events received, last delta at ${lastEventTime - startTime}ms`);
          break;
        }
        if (value) {
          lastEventTime = now;
        }
        const text = decoder.decode(value, { stream: true });
        buffer += text;
        const parts = buffer.split('\n\n');
        for (const part of parts) {
          if (part.trim()) {
            setEvents(prev => [...prev, `[${now - startTime}ms] ${part}`]);
          }
        }
        buffer = parts[parts.length - 1];
        // 每秒更新一次状态
        setStatus(`receiving at ${now - startTime}ms, ${events.length} events`);
      }
    } catch (e: any) {
      setStatus(`ERROR at ${Date.now() - startTime}ms: ${e.message}`);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>SSE Test</h1>
      <div>
        <label><input type="radio" checked={mode === 'fetch'} onChange={() => setMode('fetch')} /> Fetch test-sse</label>
        <label style={{ marginLeft: 20 }}><input type="radio" checked={mode === 'eventsource'} onChange={() => setMode('eventsource')} /> EventSource test-sse</label>
        <label style={{ marginLeft: 20 }}><input type="radio" checked={mode === 'advance'} onChange={() => setMode('advance')} /> POST advance-sse (real LLM)</label>
      </div>
      <button onClick={start} style={{ padding: 10, fontSize: 16, marginTop: 10 }}>Start Test ({mode})</button>
      <div>Status: <strong>{status}</strong></div>
      <div>Events received: {events.length}</div>
      <div style={{ marginTop: 20 }}>
        {events.slice(-10).map((e, i) => (
          <div key={i} style={{ background: '#222', color: '#0f0', padding: 5, margin: 2, fontSize: 12 }}>
            {e}
          </div>
        ))}
      </div>
    </div>
  );
}
