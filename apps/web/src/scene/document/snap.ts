import type { Vec3 } from './reducer';

export function snap(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function snapVec3([x, y, z]: Vec3, step: number): Vec3 {
  return [snap(x, step), snap(y, step), snap(z, step)];
}