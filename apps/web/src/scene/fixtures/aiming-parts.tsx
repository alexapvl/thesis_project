import type { RefObject } from 'react';
import * as THREE from 'three';
import { HOVER_TINT, SELECTED_TINT } from './fixture-interaction';

type HazeBeamProps = {
  meshRef: RefObject<THREE.Mesh>;
  geometry: THREE.BufferGeometry;
  texture: THREE.CanvasTexture;
  position: [number, number, number];
};

export function HazeBeam({ meshRef, geometry, texture, position }: HazeBeamProps) {
  return (
    <mesh ref={meshRef} geometry={geometry} position={position} renderOrder={1} raycast={() => null}>
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

type SelectionBoxesProps = {
  selected: boolean;
  hovered: boolean;
  size: [number, number, number];
};

export function SelectionBoxes({ selected, hovered, size }: SelectionBoxesProps) {
  return (
    <>
      {hovered && !selected && (
        <mesh raycast={() => null}>
          <boxGeometry args={size} />
          <meshBasicMaterial color={HOVER_TINT} wireframe />
        </mesh>
      )}
      {selected && (
        <mesh raycast={() => null}>
          <boxGeometry args={size} />
          <meshBasicMaterial color={SELECTED_TINT} wireframe />
        </mesh>
      )}
    </>
  );
}
