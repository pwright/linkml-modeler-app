/**
 * Encodes/decodes a CanvasLayout to/from a URL-safe string.
 *
 * Format: gzip → base64url. Keeps URLs compact (~1KB for 20 nodes).
 * Uses browser CompressionStream API (baseline 2023).
 */

import type { CanvasLayout } from '../model/index.js';

export async function encodeLayout(layout: CanvasLayout): Promise<string> {
  const compact: Record<string, unknown> = { n: {} as Record<string, unknown> };

  for (const [name, pos] of Object.entries(layout.nodes)) {
    const entry: Record<string, number> = { x: Math.round(pos.x), y: Math.round(pos.y) };
    if (pos.collapsed) (entry as Record<string, unknown>).c = 1;
    (compact.n as Record<string, unknown>)[name] = entry;
  }

  const vp = layout.viewport;
  if (vp.x !== 0 || vp.y !== 0 || vp.zoom !== 1) {
    compact.v = { x: Math.round(vp.x), y: Math.round(vp.y), z: Math.round(vp.zoom * 100) / 100 };
  }

  const json = JSON.stringify(compact);
  const compressed = await gzipCompress(new TextEncoder().encode(json));
  return base64UrlEncode(compressed);
}

export async function decodeLayout(encoded: string): Promise<CanvasLayout | null> {
  try {
    const compressed = base64UrlDecode(encoded);
    const json = new TextDecoder().decode(await gzipDecompress(compressed));
    const compact = JSON.parse(json);

    const nodes: CanvasLayout['nodes'] = {};
    if (compact.n && typeof compact.n === 'object') {
      for (const [name, pos] of Object.entries(compact.n as Record<string, Record<string, unknown>>)) {
        nodes[name] = {
          x: Number(pos.x) || 0,
          y: Number(pos.y) || 0,
          ...(pos.c ? { collapsed: true } : {}),
        };
      }
    }

    const viewport = compact.v
      ? { x: Number(compact.v.x) || 0, y: Number(compact.v.y) || 0, zoom: Number(compact.v.z) || 1 }
      : { x: 0, y: 0, zoom: 1 };

    return { nodes, viewport };
  } catch {
    return null;
  }
}

async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  // Sink writer errors so they don't leak as unhandled rejections
  const writePromise = writer.write(data as unknown as BufferSource).then(() => writer.close()).catch(() => {});
  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } catch {
    await writePromise;
    throw new Error('decompression failed');
  }
  await writePromise;
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
