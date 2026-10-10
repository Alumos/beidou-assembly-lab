(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BeidouClockModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const METERS_PER_NS = .299792458;
  // Four independent range observations solve planar x/y and receiver-clock bias.
  // The three terminals represent separate illustrative geometries, not one measured map.
  const GEOMETRIES = {
    car: [.20, 1.65, 3.35, 5.30],
    ship: [.65, 2.05, 3.25, 5.35],
    phone: [.45, 2.30, 3.85, 5.80],
  };
  function solve(matrix, rhs) {
    const n = rhs.length, rows = matrix.map((row, i) => [...row, rhs[i]]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
      if (Math.abs(rows[pivot][col]) < 1e-10) throw new Error('Satellite geometry is singular');
      [rows[pivot], rows[col]] = [rows[col], rows[pivot]];
      const divisor = rows[col][col];
      for (let j = col; j <= n; j++) rows[col][j] /= divisor;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = rows[r][col];
        for (let j = col; j <= n; j++) rows[r][j] -= factor * rows[col][j];
      }
    }
    return rows.map(row => row[n]);
  }
  function estimate(rangeErrors, target = 'ship') {
    const angles = GEOMETRIES[target] || GEOMETRIES.ship;
    if (!Array.isArray(rangeErrors) || rangeErrors.length !== 4 || rangeErrors.some(v => !Number.isFinite(v))) throw new TypeError('Four finite range errors are required');
    const design = angles.map(a => [Math.cos(a), Math.sin(a), 1]);
    const normal = Array.from({ length: 3 }, () => [0, 0, 0]), rhs = [0, 0, 0];
    design.forEach((row, i) => row.forEach((v, j) => {
      rhs[j] += v * rangeErrors[i];
      row.forEach((w, k) => { normal[j][k] += v * w; });
    }));
    const [east, north, clockBiasMeters] = solve(normal, rhs);
    return { east, north, clockBiasMeters, errorMeters: Math.hypot(east, north) };
  }
  function clampNs(ns) { return Number.isFinite(ns) ? Math.max(0, Math.min(600, ns)) : 0; }
  function response(ns, target = 'ship') {
    const timeErrorNs = clampNs(ns), rangeErrorMeters = timeErrorNs * METERS_PER_NS;
    // One satellite clock is ahead: its uncorrected transmit time shortens its measured range.
    // Receiver clock offset is estimated independently, so common-clock bias is not mistaken for motion.
    return Object.assign({}, estimate([-rangeErrorMeters, 0, 0, 0], target), { timeErrorNs, rangeErrorMeters });
  }
  function smooth(current, target, dt, reduced = false) {
    const a = reduced ? 1 : 1 - Math.exp(-Math.max(0, Math.min(dt, .1)) * 11);
    const result = current + (target - current) * a;
    return Math.abs(target - result) < .025 ? target : result;
  }
  function ease(value) { const t = Math.max(0, Math.min(1, value)); return t * t * t * (t * (t * 6 - 15) + 10); }
  return { METERS_PER_NS, GEOMETRIES, estimate, response, clampNs, smooth, ease };
});
