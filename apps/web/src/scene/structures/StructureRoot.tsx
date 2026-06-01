import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { StructureInstance } from '@stl/fixtures';
import { useStructurePose } from './useStructurePose';

type Props = {
  instance: StructureInstance;
  ghost?: boolean;
  wireframe?: boolean;
  handlers?: Record<string, unknown>;
  children: ReactNode;
};

export function StructureRoot({ instance, ghost, wireframe, handlers, children }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const { applyPose } = useStructurePose(instance);
  const skipPreview = ghost || wireframe;

  useFrame(() => {
    if (skipPreview) return;
    const g = groupRef.current;
    if (g) applyPose(g);
  });

  if (skipPreview) {
    return (
      <group position={instance.position} rotation={instance.rotation} {...handlers}>
        {children}
      </group>
    );
  }

  return (
    <group ref={groupRef} {...handlers}>
      {children}
    </group>
  );
}
