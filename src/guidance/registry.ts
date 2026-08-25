import type { GuidanceMode, ModeId } from './GuidanceMode';
import { FarArrowMode, EscortArrowMode } from './ArrowVariants';

/**
 * Tasten 1-2: die beiden verbleibenden Pfeil-Varianten.
 *
 * Der Wechsel behaelt Aufgabe und Flugzustand bei - nur so ist der Vergleich
 * ehrlich.
 */
export const GUIDANCE_MODES: Record<ModeId, () => GuidanceMode> = {
  far: () => new FarArrowMode(),
  escort: () => new EscortArrowMode(),
};

export const MODE_ORDER: ModeId[] = [
  'far', 'escort',
];

/** Wie viele Varianten im Tutorial erreichbar sind. */
export const ARROW_VARIANTS = 2;

export const MODE_LABELS: Record<ModeId, string> = {
  far: 'Fern',
  escort: 'Begleiter',
};
