import type { GuidanceMode, ModeId } from './GuidanceMode';
import { FarArrowMode, EscortArrowMode, ThresholdArrowMode, DrawnArrowMode } from './ArrowVariants';
import { ArrowMode } from './ArrowMode';
import { GateMode } from './GateMode';
import { FlowMode } from './FlowMode';
import { CurtainMode } from './CurtainMode';

/**
 * Tasten 1-4: die vier Pfeil-Varianten, um die es gerade geht.
 * Tasten 5-8: die frueheren Sprachen, geparkt aber erreichbar.
 *
 * Der Wechsel behaelt Aufgabe und Flugzustand bei - nur so ist der Vergleich
 * ehrlich.
 */
export const GUIDANCE_MODES: Record<ModeId, () => GuidanceMode> = {
  far: () => new FarArrowMode(),
  escort: () => new EscortArrowMode(),
  threshold: () => new ThresholdArrowMode(),
  drawn: () => new DrawnArrowMode(),

  arrow: () => new ArrowMode(),
  gate: () => new GateMode(),
  flow: () => new FlowMode(),
  curtain: () => new CurtainMode(),
};

export const MODE_ORDER: ModeId[] = [
  'far', 'escort', 'threshold', 'drawn',
  'arrow', 'gate', 'flow', 'curtain',
];

/** Wie viele davon zur laufenden Pfeil-Arbeit gehoeren (Tasten 1-4). */
export const ARROW_VARIANTS = 4;

export const MODE_LABELS: Record<ModeId, string> = {
  far: 'Fern',
  escort: 'Begleiter',
  threshold: 'Schwelle',
  drawn: 'Zeichner',
  arrow: 'Kette (alt)',
  gate: 'Tor (alt)',
  flow: 'Sog (alt)',
  curtain: 'Blende (alt)',
};
