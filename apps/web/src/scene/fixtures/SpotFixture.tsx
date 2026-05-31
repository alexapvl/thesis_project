import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';
import { exponentialAlpha, smoothScalar } from '@/scene/mappers/smoothing';
import { useTransformPreview } from '@/scene/editor/TransformPreviewProvider';
import { useStore } from '@/store';

type Props = {
  instance: FixtureInstance;
  selected: boolean;
  onSelect: (id: string) => void;
};

const SPOT_INTENSITY_GAIN = 60;
const LENS_EMISSIVE_GAIN = 1.5;
const POOL_OPACITY_GAIN = 0.35;
const HAZE_OPACITY_GAIN = 0.09;
const HAZE_MAX_LENGTH = 30;
const FLOOR_Y = 0.02;

// Beat-driven movement. Skip-BART only predicts (hue, value), so we
// displace each fixture's aim point on every beat from BeatNet within a
// configured XZ radius around its scene-document target. One offset per
// fixture so spotlights sweep independently; smoothed over MOVE_TAU_SECONDS
// so the path reads as a curve rather than a teleport.
const MOVE_RADIUS = 3.5;
const MOVE_TAU_SECONDS = 0.10;
const MOVE_MIN_DISTANCE = 1.5;
const DOWNBEAT_RADIUS_BOOST = 1.6;

const BASE_COLOR = '#475569';
const ARM_COLOR = '#334155';
const HEAD_COLOR = '#1e293b';
const SELECTED_TINT = '#fbbf24';

function createPoolTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Soft axial + radial falloff so the beam reads as haze, not a solid cone. */
function createHazeConeTexture(): THREE.CanvasTexture {
  const width = 64;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const axial = ctx.createLinearGradient(0, 0, 0, height);
    axial.addColorStop(0, 'rgba(255,255,255,0.85)');
    axial.addColorStop(0.12, 'rgba(255,255,255,0.45)');
    axial.addColorStop(0.55, 'rgba(255,255,255,0.12)');
    axial.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = axial;
    ctx.fillRect(0, 0, width, height);

    const radial = ctx.createRadialGradient(width / 2, 0, 0, width / 2, height / 2, width / 2);
    radial.addColorStop(0, 'rgba(255,255,255,1)');
    radial.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    radial.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function SpotFixture({ instance, selected, onSelect }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const lensMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const hazeConeRef = useRef<THREE.Mesh>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);
  const poolObj = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const obj = new THREE.Mesh(new THREE.CircleGeometry(1, 32), material);
    obj.rotation.x = -Math.PI / 2;
    obj.renderOrder = 1;
    return obj;
  }, []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const aimScratch = useMemo(() => new THREE.Vector3(), []);
  const headWorldScratch = useMemo(() => new THREE.Vector3(), []);
  const moveState = useRef({
    currentX: 0,
    currentZ: 0,
    targetX: 0,
    targetZ: 0,
    lastBeatMs: -1 as number,
  });
  const smoothed = useSmoothedLighting();
  const preview = useTransformPreview();
  const scene = useThree((s) => s.scene);
  const poolTexture = useMemo(() => createPoolTexture(), []);
  const hazeConeTexture = useMemo(() => createHazeConeTexture(), []);

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const angle = (instance.overrides.angleRad as number) ?? Math.PI / 6;
  const distance = (instance.overrides.distance as number) ?? 30;
  const penumbra = (instance.overrides.penumbra as number) ?? 0.2;

  const hazeConeGeom = useMemo(() => {
    const g = new THREE.ConeGeometry(Math.tan(angle), 1, 32, 1, true);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -0.5);
    return g;
  }, [angle]);

  useEffect(() => {
    const poolMaterial = poolObj.material as THREE.MeshBasicMaterial;
    poolMaterial.map = poolTexture;
    scene.add(targetObj);
    scene.add(poolObj);
    return () => {
      scene.remove(targetObj);
      scene.remove(poolObj);
      poolTexture.dispose();
      poolObj.geometry.dispose();
      poolObj.material.dispose();
    };
  }, [scene, targetObj, poolObj, poolTexture]);

  useEffect(() => () => hazeConeGeom.dispose(), [hazeConeGeom]);
  useEffect(() => () => hazeConeTexture.dispose(), [hazeConeTexture]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    const live = preview.current.fixtureId === instance.id;
    if (g) {
      if (live && preview.current.position) g.position.copy(preview.current.position);
      else g.position.set(...instance.position);
      if (live && preview.current.rotation) g.rotation.copy(preview.current.rotation);
      else g.rotation.set(...instance.rotation);
    }

    if (live && preview.current.target) {
      aimScratch.copy(preview.current.target);
    } else {
      aimScratch.set(instance.target[0], instance.target[1], instance.target[2]);
      const lighting = useStore.getState().lighting;
      const beatMs = lighting.lastBeatTimeMs;
      const m = moveState.current;
      if (beatMs != null && beatMs !== m.lastBeatMs) {
        const isDownbeat =
          lighting.lastDownbeatTimeMs != null && lighting.lastDownbeatTimeMs === beatMs;
        const radius = isDownbeat ? MOVE_RADIUS * DOWNBEAT_RADIUS_BOOST : MOVE_RADIUS;
        let nx = 0;
        let nz = 0;
        for (let i = 0; i < 6; i++) {
          nx = (Math.random() * 2 - 1) * radius;
          nz = (Math.random() * 2 - 1) * radius;
          const dx = nx - m.currentX;
          const dz = nz - m.currentZ;
          if (dx * dx + dz * dz >= MOVE_MIN_DISTANCE * MOVE_MIN_DISTANCE) break;
        }
        m.targetX = nx;
        m.targetZ = nz;
        m.lastBeatMs = beatMs;
      }
      const a = exponentialAlpha(delta, MOVE_TAU_SECONDS);
      m.currentX = smoothScalar(m.currentX, m.targetX, a);
      m.currentZ = smoothScalar(m.currentZ, m.targetZ, a);
      aimScratch.x += m.currentX;
      aimScratch.z += m.currentZ;
    }
    targetObj.position.copy(aimScratch);

    const head = headRef.current;
    if (head) {
      head.lookAt(aimScratch);
      head.rotateY(Math.PI);
    }

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

    const pool = poolObj;
    if (render.intensity <= 0) {
      pool.visible = false;
    } else {
      pool.visible = true;
      pool.position.set(aimScratch.x, FLOOR_Y, aimScratch.z);
      head?.getWorldPosition(headWorldScratch);
      const dx = aimScratch.x - headWorldScratch.x;
      const dz = aimScratch.z - headWorldScratch.z;
      const horizDist = Math.sqrt(dx * dx + dz * dz);
      const poolRadius = Math.max(0.35, Math.min(horizDist * Math.tan(angle), distance * Math.tan(angle)));
      pool.scale.set(poolRadius, poolRadius, 1);
      const poolMaterial = pool.material as THREE.MeshBasicMaterial;
      poolMaterial.color.copy(render.color);
      poolMaterial.opacity = Math.min(1, render.intensity * POOL_OPACITY_GAIN);
    }

    const hazeCone = hazeConeRef.current;
    if (hazeCone) {
      if (render.intensity <= 0) {
        hazeCone.visible = false;
      } else {
        hazeCone.visible = true;
        head?.getWorldPosition(headWorldScratch);
        const length = Math.min(headWorldScratch.distanceTo(aimScratch), HAZE_MAX_LENGTH);
        hazeCone.scale.set(length, length, length);
        const hazeMaterial = hazeCone.material as THREE.MeshBasicMaterial;
        hazeMaterial.color.copy(render.color);
        hazeMaterial.opacity = Math.min(0.14, render.intensity * HAZE_OPACITY_GAIN);
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
      <spotLight
        ref={lightRef}
        angle={angle}
        penumbra={penumbra}
        distance={distance}
        decay={2}
        target={targetObj}
        castShadow={false}
      />

      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.12, 20]} />
        <meshStandardMaterial
          color={selected ? SELECTED_TINT : BASE_COLOR}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      <mesh position={[-0.2, 0.0, 0]}>
        <boxGeometry args={[0.05, 0.36, 0.08]} />
        <meshStandardMaterial color={selected ? SELECTED_TINT : ARM_COLOR} metalness={0.3} />
      </mesh>
      <mesh position={[0.2, 0.0, 0]}>
        <boxGeometry args={[0.05, 0.36, 0.08]} />
        <meshStandardMaterial color={selected ? SELECTED_TINT : ARM_COLOR} metalness={0.3} />
      </mesh>

      <group ref={headRef} position={[0, 0.05, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.42, 20]} />
          <meshStandardMaterial color={HEAD_COLOR} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.04, 20]} />
          <meshStandardMaterial ref={lensMatRef} color={HEAD_COLOR} />
        </mesh>
        <mesh ref={hazeConeRef} geometry={hazeConeGeom} position={[0, 0, -0.22]} renderOrder={1}>
          <meshBasicMaterial
            map={hazeConeTexture}
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
