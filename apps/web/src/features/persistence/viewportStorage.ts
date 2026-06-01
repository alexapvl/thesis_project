export const VIEWPORT_KEY = 'stl.viewport.v1';

export type CameraViewport = {
  position: [number, number, number];
  target: [number, number, number];
};

function isVec3(v: unknown): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    typeof v[2] === 'number' &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    Number.isFinite(v[2])
  );
}

export function loadViewport(): CameraViewport | null {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (
      typeof data === 'object' &&
      data !== null &&
      isVec3((data as CameraViewport).position) &&
      isVec3((data as CameraViewport).target)
    ) {
      return data as CameraViewport;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveViewport(viewport: CameraViewport): void {
  try {
    localStorage.setItem(VIEWPORT_KEY, JSON.stringify(viewport));
  } catch {
    /* quota or privacy mode */
  }
}
