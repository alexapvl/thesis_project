import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';
import { exponentialAlpha, smoothScalar } from '@/scene/mappers/smoothing';
import {
  beatAimOffset,
  downbeatAccent,
  readOverrideNumber,
  seedFrom,
} from '@/scene/mappers/fixtureBehavior';
import { useTransformPreview } from '@/scene/editor/TransformPreviewProvider';
import { useStore } from '@/store';
import {
  fixturePointerHandlers,
  HOVER_TINT,
  SELECTED_TINT,
  type FixtureInteractionProps,
} from './fixture-interaction';
import { createHazeConeTexture, createPoolTexture } from './haze-textures';

export type AimingFixtureVisual = {
  intensityGain: number;
  lensEmissiveGain: number;
  poolOpacityGain: number;
  hazeOpacityGain: number;
  hazeMaxLength: number;
  hazeOpacityCap: number;
  downbeatRadiusBoost: number;
  moveMinDistance: number;
  softHaze: boolean;
  saturateColor: boolean;
  headScale: number;
};

type Props = FixtureInteractionProps & {
  instance: FixtureInstance;
  visual: AimingFixtureVisual;
};

const BASE_COLOR = '#475569';
const ARM_COLOR = '#334155';
const HEAD_COLOR = '#1e293b';
const FLOOR_Y = 0.02;

export function AimingFixture({ instance, selected, hovered, onSelect, onHover, visual }: Props) {
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
    obj.raycast = () => null;
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
  const fixtureSeed = useMemo(() => seedFrom(instance.id), [instance.id]);
  const smoothed = useSmoothedLighting();
  const preview = useTransformPreview();
  const scene = useThree((s) => s.scene);
  const poolTexture = useMemo(() => createPoolTexture(), []);
  const hazeConeTexture = useMemo(() => createHazeConeTexture(visual.softHaze), [visual.softHaze]);

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const defaults = definition?.defaultProps;
  const angle =
    readOverrideNumber(instance.overrides, defaults, 'angleRad', Math.PI / 6);
  const distance = readOverrideNumber(instance.overrides, defaults, 'distance', 30);
  const penumbra = readOverrideNumber(instance.overrides, defaults, 'penumbra', 0.2);
  const moveRadius = readOverrideNumber(instance.overrides, defaults, 'moveRadius', 3.5);
  const moveTauSeconds = readOverrideNumber(
    instance.overrides,
    defaults,
    'moveTauSeconds',
    0.1,
  );

  const hazeConeGeom = useMemo(() => {
    const g = new THREE.ConeGeometry(Math.tan(angle), 1, 32, 1, true);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -0.5);
    return g;
  }, [angle]);

  const handlers = fixturePointerHandlers(instance.id, onSelect, onHover);
  const hs = visual.headScale;

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
        const offset = beatAimOffset(fixtureSeed, beatMs, {
          radius: moveRadius,
          downbeatBoost: visual.downbeatRadiusBoost,
          minDistance: visual.moveMinDistance,
          currentX: m.currentX,
          currentZ: m.currentZ,
          isDownbeat,
        });
        m.targetX = offset.x;
        m.targetZ = offset.z;
        m.lastBeatMs = beatMs;
      }
      const a = exponentialAlpha(delta, moveTauSeconds);
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
    const accent = downbeatAccent(
      Date.now(),
      useStore.getState().lighting.lastDownbeatTimeMs,
      180,
    );
    let intensity = render.intensity * (1 + accent * 0.35);
    if (lightRef.current) {
      const c = render.color.clone();
      if (visual.saturateColor) c.setHSL(c.getHSL({ h: 0, s: 0, l: 0 }).h, 1, 0.55);
      lightRef.current.color.copy(c);
      lightRef.current.intensity = intensity * visual.intensityGain;
    }
    if (lensMatRef.current) {
      lensMatRef.current.color.copy(render.color);
      lensMatRef.current.emissive.copy(render.color);
      lensMatRef.current.emissiveIntensity = intensity * visual.lensEmissiveGain;
    }

    const pool = poolObj;
    if (intensity <= 0) {
      pool.visible = false;
    } else {
      pool.visible = true;
      pool.position.set(aimScratch.x, FLOOR_Y, aimScratch.z);
      head?.getWorldPosition(headWorldScratch);
      const dx = aimScratch.x - headWorldScratch.x;
      const dz = aimScratch.z - headWorldScratch.z;
      const horizDist = Math.sqrt(dx * dx + dz * dz);
      const poolRadius = Math.max(
        0.35,
        Math.min(horizDist * Math.tan(angle), distance * Math.tan(angle)),
      );
      pool.scale.set(poolRadius, poolRadius, 1);
      const poolMaterial = pool.material as THREE.MeshBasicMaterial;
      poolMaterial.color.copy(render.color);
      poolMaterial.opacity = Math.min(1, intensity * visual.poolOpacityGain);
    }

    const hazeCone = hazeConeRef.current;
    if (hazeCone) {
      if (intensity <= 0) {
        hazeCone.visible = false;
      } else {
        hazeCone.visible = true;
        head?.getWorldPosition(headWorldScratch);
        const length = Math.min(
          headWorldScratch.distanceTo(aimScratch),
          visual.hazeMaxLength,
        );
        hazeCone.scale.set(length, length, length);
        const hazeMaterial = hazeCone.material as THREE.MeshBasicMaterial;
        hazeMaterial.color.copy(render.color);
        hazeMaterial.opacity = Math.min(
          visual.hazeOpacityCap,
          intensity * visual.hazeOpacityGain,
        );
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={instance.position}
      rotation={instance.rotation}
      {...handlers}
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
        <cylinderGeometry args={[0.22 * hs, 0.28 * hs, 0.12, 20]} />
        <meshStandardMaterial
          color={selected ? SELECTED_TINT : BASE_COLOR}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      <mesh position={[-0.2 * hs, 0, 0]}>
        <boxGeometry args={[0.05, 0.36 * hs, 0.08]} />
        <meshStandardMaterial color={selected ? SELECTED_TINT : ARM_COLOR} metalness={0.3} />
      </mesh>
      <mesh position={[0.2 * hs, 0, 0]}>
        <boxGeometry args={[0.05, 0.36 * hs, 0.08]} />
        <meshStandardMaterial color={selected ? SELECTED_TINT : ARM_COLOR} metalness={0.3} />
      </mesh>

      <group ref={headRef} position={[0, 0.05, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16 * hs, 0.16 * hs, 0.42 * hs, 20]} />
          <meshStandardMaterial color={HEAD_COLOR} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, -0.22 * hs]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.17 * hs, 0.17 * hs, 0.04, 20]} />
          <meshStandardMaterial ref={lensMatRef} color={HEAD_COLOR} />
        </mesh>
        <mesh
          ref={hazeConeRef}
          geometry={hazeConeGeom}
          position={[0, 0, -0.22 * hs]}
          renderOrder={1}
          raycast={() => null}
        >
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

      {hovered && !selected && (
        <mesh raycast={() => null}>
          <boxGeometry args={[0.6 * hs, 0.75 * hs, 0.6 * hs]} />
          <meshBasicMaterial color={HOVER_TINT} wireframe />
        </mesh>
      )}

      {selected && (
        <mesh raycast={() => null}>
          <boxGeometry args={[0.55 * hs, 0.7 * hs, 0.55 * hs]} />
          <meshBasicMaterial color={SELECTED_TINT} wireframe />
        </mesh>
      )}
    </group>
  );
}

export const SPOT_VISUAL: AimingFixtureVisual = {
  intensityGain: 60,
  lensEmissiveGain: 1.5,
  poolOpacityGain: 0.35,
  hazeOpacityGain: 0.09,
  hazeMaxLength: 30,
  hazeOpacityCap: 0.14,
  downbeatRadiusBoost: 1.6,
  moveMinDistance: 1.5,
  softHaze: false,
  saturateColor: false,
  headScale: 1,
};

export const WASH_VISUAL: AimingFixtureVisual = {
  intensityGain: 45,
  lensEmissiveGain: 1.2,
  poolOpacityGain: 0.5,
  hazeOpacityGain: 0.06,
  hazeMaxLength: 28,
  hazeOpacityCap: 0.1,
  downbeatRadiusBoost: 1.4,
  moveMinDistance: 2,
  softHaze: true,
  saturateColor: false,
  headScale: 1.05,
};

export const BEAM_VISUAL: AimingFixtureVisual = {
  intensityGain: 90,
  lensEmissiveGain: 2,
  poolOpacityGain: 0.2,
  hazeOpacityGain: 0.14,
  hazeMaxLength: 40,
  hazeOpacityCap: 0.2,
  downbeatRadiusBoost: 2,
  moveMinDistance: 2.5,
  softHaze: false,
  saturateColor: true,
  headScale: 0.95,
};
