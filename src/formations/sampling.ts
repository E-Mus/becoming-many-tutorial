/**
 * Abtast-Hilfen fuer Punktwolken.
 *
 * Gleichverteilter Zufall klumpt sichtbar. Mitchells Best-Candidate liefert
 * ~90 % der Poisson-Disc-Qualitaet mit einem Zehntel des Aufwands: ziehe k
 * Kandidaten, nimm den, der am weitesten vom naechsten bereits gesetzten Punkt
 * entfernt ist.
 */

/** Deterministischer PRNG, damit dieselbe Form immer gleich aussieht. */
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Best-Candidate-Abtastung in 2D innerhalb einer Maske.
 * @param inside Praedikat: liegt (x, y) in der Form?
 */
export function bestCandidate2D(
  n: number,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  inside: (x: number, y: number) => boolean,
  rng: () => number,
  k = 6,
): Float32Array {
  const pts = new Float32Array(n * 2);
  let placed = 0;
  // Gitter zur Nachbarsuche, damit die Distanzpruefung nicht O(n^2) wird.
  const cell = Math.sqrt(((bounds.x1 - bounds.x0) * (bounds.y1 - bounds.y0)) / Math.max(n, 1)) * 2;
  const cols = Math.max(1, Math.ceil((bounds.x1 - bounds.x0) / cell));
  const rows = Math.max(1, Math.ceil((bounds.y1 - bounds.y0) / cell));
  const grid: number[][] = Array.from({ length: cols * rows }, () => []);
  const cellOf = (x: number, y: number) => {
    const c = Math.min(cols - 1, Math.max(0, Math.floor((x - bounds.x0) / cell)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor((y - bounds.y0) / cell)));
    return r * cols + c;
  };

  let guard = 0;
  while (placed < n && guard < n * 200) {
    let bx = 0, by = 0, bd = -1;
    for (let c = 0; c < k; c++) {
      let x = 0, y = 0, ok = false;
      for (let t = 0; t < 40 && !ok; t++) {
        x = bounds.x0 + rng() * (bounds.x1 - bounds.x0);
        y = bounds.y0 + rng() * (bounds.y1 - bounds.y0);
        ok = inside(x, y);
        guard++;
      }
      if (!ok) continue;

      // Abstand zum naechsten bereits gesetzten Punkt (nur Nachbarzellen).
      let nearest = Infinity;
      const ci = Math.floor((x - bounds.x0) / cell);
      const ri = Math.floor((y - bounds.y0) / cell);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = ri + dr, cc = ci + dc;
          if (r < 0 || cc < 0 || r >= rows || cc >= cols) continue;
          for (const idx of grid[r * cols + cc]) {
            const dx = pts[idx * 2] - x, dy = pts[idx * 2 + 1] - y;
            const d = dx * dx + dy * dy;
            if (d < nearest) nearest = d;
          }
        }
      }
      if (nearest > bd) { bd = nearest; bx = x; by = y; }
    }
    if (bd < 0) { guard++; continue; }
    pts[placed * 2] = bx;
    pts[placed * 2 + 1] = by;
    grid[cellOf(bx, by)].push(placed);
    placed++;
  }
  return pts;
}
