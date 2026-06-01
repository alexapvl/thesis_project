import { useCallback } from 'react';
import type { StructureInstance } from '@stl/fixtures';
import { useTransformPreview } from '@/scene/editor/TransformPreviewProvider';
import type * as THREE from 'three';
import { applyStructureWorldPose } from './structureWorldPose';

/** Apply document pose or live TransformControls preview to a structure root group. */
export function useStructurePose(instance: StructureInstance) {
  const preview = useTransformPreview();

  const applyPose = useCallback(
    (g: THREE.Group) => {
      applyStructureWorldPose(g, instance, preview.current);
    },
    [instance, preview],
  );

  return { applyPose };
}
