import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '@/store';
import { socketsForStructure } from '@/scene/structures/sockets';
import { HOVER_TINT } from '@/scene/fixtures/fixture-interaction';

const SOCKET_RADIUS = 0.08;

/**
 * Clickable socket markers when a fixture is selected (click-to-mount mode).
 */
export function SocketPicker() {
  const selectedId = useStore((s) => s.scene.doc.selectedFixtureId);
  const structures = useStore((s) => s.scene.doc.structures);
  const dispatch = useStore((s) => s.sceneDispatch);
  const placement = useStore(
    (s) => s.editor.pendingFixtureTypeId ?? s.editor.pendingStructureTypeId,
  );

  const markers = useMemo(() => {
    if (!selectedId || placement) return [];
    const out: { key: string; world: THREE.Vector3; structureId: string; socketId: string }[] =
      [];
    const obj = new THREE.Object3D();
    for (const structure of structures) {
      obj.position.set(...structure.position);
      obj.rotation.set(...structure.rotation);
      obj.updateMatrixWorld(true);
      for (const socket of socketsForStructure(structure)) {
        const world = new THREE.Vector3(...socket.localPos).applyMatrix4(obj.matrixWorld);
        out.push({
          key: `${structure.id}:${socket.id}`,
          world,
          structureId: structure.id,
          socketId: socket.id,
        });
      }
    }
    return out;
  }, [selectedId, structures, placement]);

  if (!selectedId || placement) return null;

  return (
    <group>
      {markers.map((m) => (
        <mesh
          key={m.key}
          position={[m.world.x, m.world.y, m.world.z]}
          onClick={(e) => {
            e.stopPropagation();
            dispatch({
              type: 'fixture.mount',
              id: selectedId,
              structureId: m.structureId,
              socketId: m.socketId,
            });
          }}
        >
          <sphereGeometry args={[SOCKET_RADIUS, 10, 10]} />
          <meshBasicMaterial color={HOVER_TINT} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}
