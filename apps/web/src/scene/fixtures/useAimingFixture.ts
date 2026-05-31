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
import { fixturePointerHandlers } from './fixture-interaction';
import { createHazeConeTexture, createPoolTexture } from './haze-textures';
import type { AimingFixtureVisual } from './aiming-visual';

const FLOOR_Y = 0.02;

type AimingOptions = {
  /** Shared lens material (e.g. wash LED array). When set, hook drives this instead of lensMatRef. */
  lensMaterial?: THREE.MeshStandardMaterial;
};

export function useAimingFixture(
  instance: FixtureInstance,
  visual: AimingFixtureVisual,
  onSelect: (id: string) => void,
  onHover: (id: string | null) => void,
  options?: AimingOptions,
) {
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
  const angle = readOverrideNumber(instance.overrides, defaults, 'angleRad', Math.PI / 6);
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
    const intensity = render.intensity * (1 + accent * 0.35);
    if (lightRef.current) {
      const c = render.color.clone();
      if (visual.saturateColor) c.setHSL(c.getHSL({ h: 0, s: 0, l: 0 }).h, 1, 0.55);
      lightRef.current.color.copy(c);
      lightRef.current.intensity = intensity * visual.intensityGain;
    }
    const lens = options?.lensMaterial ?? lensMatRef.current;
    if (lens) {
      lens.color.copy(render.color);
      lens.emissive.copy(render.color);
      lens.emissiveIntensity = intensity * visual.lensEmissiveGain;
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

  return {
    groupRef,
    headRef,
    lightRef,
    lensMatRef,
    hazeConeRef,
    hazeConeGeom,
    hazeConeTexture,
    targetObj,
    angle,
    penumbra,
    distance,
    handlers,
  };
}
