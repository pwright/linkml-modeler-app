import { describe, it, expect } from 'vitest';
import { encodeLayout, decodeLayout } from '../layoutCodec.js';
import type { CanvasLayout } from '../../model/index.js';

describe('layoutCodec', () => {
  it('round-trips a layout with nodes and viewport', async () => {
    const layout: CanvasLayout = {
      nodes: {
        Person: { x: 100, y: 200 },
        Organization: { x: 300, y: 400, collapsed: true },
      },
      viewport: { x: -50, y: 75, zoom: 1.5 },
    };

    const encoded = await encodeLayout(layout);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = await decodeLayout(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.nodes.Person).toEqual({ x: 100, y: 200 });
    expect(decoded!.nodes.Organization).toEqual({ x: 300, y: 400, collapsed: true });
    expect(decoded!.viewport).toEqual({ x: -50, y: 75, zoom: 1.5 });
  });

  it('round-trips a layout with default viewport', async () => {
    const layout: CanvasLayout = {
      nodes: { MyClass: { x: 10, y: 20 } },
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const encoded = await encodeLayout(layout);
    const decoded = await decodeLayout(encoded);
    expect(decoded!.nodes.MyClass).toEqual({ x: 10, y: 20 });
    expect(decoded!.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('produces URL-safe characters only', async () => {
    const layout: CanvasLayout = {
      nodes: { A: { x: 1, y: 2 } },
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const encoded = await encodeLayout(layout);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns null for invalid input', async () => {
    expect(await decodeLayout('')).toBeNull();
    expect(await decodeLayout('not-valid-data')).toBeNull();
  });

  it('rounds fractional positions', async () => {
    const layout: CanvasLayout = {
      nodes: { X: { x: 100.7, y: 200.3 } },
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const encoded = await encodeLayout(layout);
    const decoded = await decodeLayout(encoded);
    expect(decoded!.nodes.X).toEqual({ x: 101, y: 200 });
  });
});
