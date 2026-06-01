import type * as THREE from 'three';
import type { StructureInstance } from '@stl/fixtures';
import type { TransformPreview } from '@/scene/editor/TransformPreviewProvider';

/** Apply document or in-flight transform preview pose to an Object3D. */
export function applyStructureWorldPose(
  obj: THREE.Object3D,
  structure: StructureInstance,
  preview?: TransformPreview | null,
): void {
  const live = preview?.structureId === structure.id;
  if (live && preview.position) {
    obj.position.copy(preview.position);
    if (preview.rotation) obj.rotation.copy(preview.rotation);
    else obj.rotation.set(...structure.rotation);
    return;
  }
  if (live && preview.rotation) {
    obj.position.set(...structure.position);
    obj.rotation.copy(preview.rotation);
    return;
  }
  obj.position.set(...structure.position);
  obj.rotation.set(...structure.rotation);
}
