import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';

/**
 * In-flight transform preview. While the user drags a TransformControls
 * gizmo we want the fixture's mesh to follow live (the gizmo body alone
 * isn't enough to read what the new pose will look like). Document state
 * is only updated once on mouseUp so undo/redo stays per-drag.
 *
 * TransformHandles writes here on every gizmo change; the fixture
 * components read it inside useFrame and override their group's
 * position/rotation. When `fixtureId === null` the override is inactive
 * and fixtures render straight from the document.
 *
 * Same pattern as SmoothedLightingProvider: a ref through context, so
 * 60 Hz drag updates do not trigger React re-renders.
 */
export type TransformPreview = {
  fixtureId: string | null;
  position: THREE.Vector3 | null;
  rotation: THREE.Euler | null;
  // Live target during a TargetHandle drag. SpotFixture reads this so
  // the head's aim and the spotLight's target follow the user's
  // cursor without waiting for mouseUp.
  target: THREE.Vector3 | null;
};

export type TransformPreviewRef = { current: TransformPreview };

const TransformPreviewContext = createContext<TransformPreviewRef | null>(null);

export function TransformPreviewProvider({ children }: { children: ReactNode }) {
  const ref = useRef<TransformPreview>({
    fixtureId: null,
    position: null,
    rotation: null,
    target: null,
  });
  const value = useMemo(() => ref, []);
  return (
    <TransformPreviewContext.Provider value={value}>{children}</TransformPreviewContext.Provider>
  );
}

export function useTransformPreview(): TransformPreviewRef {
  const ctx = useContext(TransformPreviewContext);
  if (!ctx) {
    throw new Error('useTransformPreview must be used inside <TransformPreviewProvider>');
  }
  return ctx;
}
