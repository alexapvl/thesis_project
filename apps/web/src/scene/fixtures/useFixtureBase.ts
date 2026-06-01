import { useCallback } from 'react';
import type { FixtureInstance } from '@stl/fixtures';
import { useStore } from '@/store';
import { resolveMountTransform } from '@/scene/structures/sockets';
import { useTransformPreview } from '@/scene/editor/TransformPreviewProvider';
import type * as THREE from 'three';

/** Apply resolved world base pose (mount, preview, or free-standing) to a fixture root group. */
export function useFixtureBase(instance: FixtureInstance) {
  const structures = useStore((s) => s.scene.doc.structures);
  const preview = useTransformPreview();

  const applyBasePose = useCallback(
    (g: THREE.Group) => {
      const live = preview.current.fixtureId === instance.id;
      if (live && preview.current.position) {
        g.position.copy(preview.current.position);
        if (preview.current.rotation) g.rotation.copy(preview.current.rotation);
        else g.rotation.set(...instance.rotation);
        return;
      }
      if (live && preview.current.rotation) {
        g.rotation.copy(preview.current.rotation);
        g.position.set(...instance.position);
        return;
      }

      if (instance.mount) {
        const structure = structures.find((s) => s.id === instance.mount!.structureId);
        if (structure) {
          const resolved = resolveMountTransform(
            structure,
            instance.mount.socketId,
            preview.current,
          );
          if (resolved) {
            g.position.set(...resolved.position);
            g.rotation.set(...resolved.rotation);
            return;
          }
        }
      }

      g.position.set(...instance.position);
      g.rotation.set(...instance.rotation);
    },
    [instance, structures, preview],
  );

  return { applyBasePose };
}
