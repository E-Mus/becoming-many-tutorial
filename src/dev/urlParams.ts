import type { ModeId } from '../guidance/GuidanceMode';
import { MODE_ORDER } from '../guidance/registry';

export interface DevOptions {
  count?: number;
  mode: ModeId;
  dev: boolean;
  /** Einzelnen Beat isolieren, z.B. ?beat=rechts */
  beat?: string;
  /** Formation stehen lassen und progress von Hand regeln */
  freeze: boolean;
}

export function readUrlParams(): DevOptions {
  const q = new URLSearchParams(location.search);
  const rawMode = q.get('mode');
  const mode = (MODE_ORDER as string[]).includes(rawMode ?? '') ? (rawMode as ModeId) : 'far';
  const count = q.get('count') ? Number(q.get('count')) : undefined;
  return {
    count: Number.isFinite(count) ? count : undefined,
    mode,
    dev: q.get('dev') !== '0',
    beat: q.get('beat') ?? undefined,
    freeze: q.get('freeze') === '1',
  };
}
