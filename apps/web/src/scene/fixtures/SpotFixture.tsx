import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';
import { useTransformPreview } from '@/scene/editor/TransformPreviewProvider';

type Props = {
  instance: FixtureInstance;
  selected: boolean;
  onSelect: (id: string) => void;
};

const SPOT_INTENSITY_GAIN = 60;
const LENS_EMISSIVE_GAIN = 1.5;

// Material colors for the moving-head body. Selected variants are warmer
// so the user can pick out which fixture is active without relying on
// the wireframe overlay.
const BASE_COLOR = '#475569';
const ARM_COLOR = '#334155';
const HEAD_COLOR = '#1e293b';
const SELECTED_TINT = '#fbbf24';

export function SpotFixture({ instance, selected, onSelect }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const lensMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  // Reused per-frame to avoid allocating Vector3s for the aim target.
  const aimScratch = useMemo(() => new THREE.Vector3(), []);
  const smoothed = useSmoothedLighting();
  const preview = useTransformPreview();

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const angle = (instance.overrides.angleRad as number) ?? Math.PI / 6;
  const distance = (instance.overrides.distance as number) ?? 30;
  const penumbra = (instance.overrides.penumbra as number) ?? 0.2;

  useFrame(() => {
    // Pose: respect the in-flight transform preview if this fixture is
    // the one being dragged.
    const g = groupRef.current;
    const live = preview.current.fixtureId === instance.id;
    if (g) {
      if (live && preview.current.position) g.position.copy(preview.current.position);
      else g.position.set(...instance.position);
      if (live && preview.current.rotation) g.rotation.copy(preview.current.rotation);
      else g.rotation.set(...instance.rotation);
    }

    // Aim point — also preview-aware. Used both for the spotLight target
    // (Three.js SpotLight needs a target Object3D) and for the head's
    // visual lookAt.
    if (live && preview.current.target) {
      aimScratch.copy(preview.current.target);
    } else {
      aimScratch.set(instance.target[0], instance.target[1], instance.target[2]);
    }
    targetObj.position.copy(aimScratch);

    const head = headRef.current;
    if (head) {
      // lookAt expects world coords; aim point is already in world space.
      // Object3D.lookAt rotates so the local -Z faces the target, which
      // matches how we modelled the head (lens at -Z).
      head.lookAt(aimScratch);
    }

    // Lighting state → spotLight + lens material.
    const render = mapLightingFrame(instance, definition, smoothed.current, colorScratch);
    if (lightRef.current) {
      lightRef.current.color.copy(render.color);
      lightRef.current.intensity = render.intensity * SPOT_INTENSITY_GAIN;
    }
    if (lensMatRef.current) {
      lensMatRef.current.color.copy(render.color);
      lensMatRef.current.emissive.copy(render.color);
      lensMatRef.current.emissiveIntensity = render.intensity * LENS_EMISSIVE_GAIN;
    }
  });

  return (
    <group
      ref={groupRef}
      position={instance.position}
      rotation={instance.rotation}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(instance.id);
      }}
    >
      <primitive object={targetObj} />
      <spotLight
        ref={lightRef}
        angle={angle}
        penumbra={penumbra}
        distance={distance}
        target={targetObj}
        castShadow={false}
      />

      {/* Base plate */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.12, 20]} />
        <meshStandardMaterial
          color={selected ? SELECTED_TINT : BASE_COLOR}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      {/* Yoke arms — two thin uprights flanking the head */}
      <mesh position={[-0.2, 0.0, 0]}>
        <boxGeometry args={[0.05, 0.36, 0.08]} />
        <meshStandardMaterial color={selected ? SELECTED_TINT : ARM_COLOR} metalness={0.3} />
      </mesh>
      <mesh position={[0.2, 0.0, 0]}>
        <boxGeometry args={[0.05, 0.36, 0.08]} />
        <meshStandardMaterial color={selected ? SELECTED_TINT : ARM_COLOR} metalness={0.3} />
      </mesh>

      {/* Head — pivots between the yoke arms to point at the target.
          Modelled with the lens at local -Z so Object3D.lookAt() aims
          correctly without an extra basis swap. */}
      <group ref={headRef} position={[0, 0.05, 0]}>
        {/* Body cylinder, axis along local Z (rotate cylinder Y→Z) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.42, 20]} />
          <meshStandardMaterial color={HEAD_COLOR} metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Lens cap at the front (-Z) — slightly larger so it reads as a
            bezel, glows with the current light color via lensMatRef. */}
        <mesh position={[0, 0, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.04, 20]} />
          <meshStandardMaterial ref={lensMatRef} color={HEAD_COLOR} />
        </mesh>
      </group>

      {selected && (
        <mesh>
          <boxGeometry args={[0.55, 0.7, 0.55]} />
          <meshBasicMaterial color={SELECTED_TINT} wireframe />
        </mesh>
      )}
    </group>
  );
}
