/**
 * Euclidean distance face-vector matcher.
 * A descriptor is a match only when Euclidean distance is strictly below 0.6.
 */

const euclideanDistance = (a, b) => {
  if (!a || !b || a.length !== 128 || b.length !== 128) return Infinity;
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

const isValidFaceDescriptor = (descriptor) => Array.isArray(descriptor)
  && descriptor.length === 128
  && descriptor.every((value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 2);

/**
 * Find the closest matching employee from a list.
 * @param {number[]} incoming  - 128-element descriptor from live feed
 * @param {Array}    employees - Active employees with faceDescriptor
 * @param {number}   threshold - Default 0.6
 * @returns {{ matched, employee, distance }}
 */
const findBestMatch = (incoming, employees, threshold = 0.6) => {
  let best = null;
  let bestDist = Infinity;

  for (const emp of employees) {
    if (!emp.faceDescriptor || emp.faceDescriptor.length !== 128) continue;
    const dist = euclideanDistance(incoming, emp.faceDescriptor);
    if (dist < bestDist) { bestDist = dist; best = emp; }
  }

  if (bestDist < threshold) {
    return { matched: true, employee: best, distance: bestDist };
  }
  return { matched: false, employee: null, distance: bestDist };
};

module.exports = { euclideanDistance, isValidFaceDescriptor, findBestMatch };
