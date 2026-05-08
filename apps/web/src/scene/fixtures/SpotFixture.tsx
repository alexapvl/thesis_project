import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
// Visible "haze cone" parameters. The cone is a stand-in for the
// volumetric look you'd get from a real fog machine + spotlight; we are
// not raymarching anything. Opacity at full brightness is tuned to read
// clearly without dominating the scene when many fixtures overlap.
const CONE_OPACITY_GAIN = 0.2;
// Cap the cone length at the spotLight's effective throw so we don't
// draw a 200-unit haze when the user parks a target far off-screen.
const CONE_MAX_LENGTH = 30;

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
  const coneRef = useRef<THREE.Mesh>(null);
  const coneMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  // Reused per-frame to avoid allocating Vector3s for the aim target
  // and head world position.
  const aimScratch = useMemo(() => new THREE.Vector3(), []);
  const headWorldScratch = useMemo(() => new THREE.Vector3(), []);
  const smoothed = useSmoothedLighting();
  const preview = useTransformPreview();
  const scene = useThree((s) => s.scene);

  // The spotLight's target Object3D MUST be a sibling of the scene root
  // (or any unrotated ancestor), not a child of the fixture group.
  // Three.js reads `target.matrixWorld` to compute the beam direction;
  // when target is nested in a rotated parent, its local position gets
  // transformed by that rotation, so the beam shoots somewhere other
  // than the world point we intended. This is the "visible cone vs lit
  // floor patch diverge under rotation" bug.
  useEffect(() => {
    scene.add(targetObj);
    return () => {
      scene.remove(targetObj);
    };
  }, [scene, targetObj]);

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const angle = (instance.overrides.angleRad as number) ?? Math.PI / 6;
  const distance = (instance.overrides.distance as number) ?? 30;
  const penumbra = (instance.overrides.penumbra as number) ?? 0.2;

  // Unit-length cone aligned along -Z (so it grows out of the head's
  // lens face), built with radius = tan(angle) so uniform scaling by
  // the head→target distance preserves the half-angle. Open base
  // (`openEnded=true`) keeps the back from showing as a flat disc when
  // viewed near-axis.
  const coneGeom = useMemo(() => {
    const g = new THREE.ConeGeometry(Math.tan(angle), 1, 32, 1, true);
    g.rotateX(Math.PI / 2); // align cone axis along Z (default is Y)
    g.translate(0, 0, -0.5); // tip at z=0, base at z=-1
    return g;
  }, [angle]);

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

    // Visible cone: scale to head→target distance (capped) so the cone
    // tip is at the lens and the base intersects the target. Hidden
    // entirely when the fixture is dark — invisible cones cluttering up
    // the depth buffer aren't useful and additive blending of "off"
    // fixtures still adds zero color but costs fragments.
    const cone = coneRef.current;
    if (cone) {
      if (render.intensity <= 0) {
        cone.visible = false;
      } else {
        cone.visible = true;
        // World-space distance from head pivot to aim point. The head's
        // world matrix is up-to-date at this point because lookAt() was
        // called above (we're past the parent group's matrix update).
        head?.getWorldPosition(headWorldScratch);
        const length = Math.min(headWorldScratch.distanceTo(aimScratch), CONE_MAX_LENGTH);
        cone.scale.set(length, length, length);
        if (coneMatRef.current) {
          coneMatRef.current.color.copy(render.color);
          coneMatRef.current.opacity = Math.min(1, render.intensity * CONE_OPACITY_GAIN);
        }
      }
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
      {/* Note: targetObj is parented to the scene root via useEffect
          above — do NOT mount it here, or the rotation of this group
          would offset where the beam actually shoots. */}
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
        {/* Visible "haze" cone. Tip sits at the lens face; uniform
            per-frame scaling stretches it out to the target. Additive
            blending so overlapping cones brighten naturally; depthWrite
            off so the cone doesn't occlude solid geometry behind it. */}
        <mesh
          ref={coneRef}
          geometry={coneGeom}
          position={[0, 0, -0.22]}
          renderOrder={1}
        >
          <meshBasicMaterial
            ref={coneMatRef}
            color={HEAD_COLOR}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
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
