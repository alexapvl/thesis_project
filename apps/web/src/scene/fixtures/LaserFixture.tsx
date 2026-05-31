import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';
import { exponentialAlpha, smoothScalar } from '@/scene/mappers/smoothing';
import {
  beatAimOffset,
  patternIndex,
  patternStep,
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

type Props = FixtureInteractionProps & { instance: FixtureInstance };

const PATTERN_COUNT = 3;
const MOVE_RADIUS = 2.5;
const MOVE_TAU = 0.12;

export function LaserFixture({ instance, selected, hovered, onSelect, onHover }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const beamsRef = useRef<THREE.Group>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const aimScratch = useMemo(() => new THREE.Vector3(), []);
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

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const defaults = definition?.defaultProps;
  const beamCount = Math.round(
    readOverrideNumber(instance.overrides, defaults, 'beamCount', 5),
  );
  const fanAngleRad = readOverrideNumber(instance.overrides, defaults, 'fanAngleRad', Math.PI / 3);
  const beamLength = readOverrideNumber(instance.overrides, defaults, 'beamLength', 18);

  const beamGeoms = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.008, 0.008, 1, 6);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -0.5);
    return g;
  }, []);

  useEffect(() => {
    scene.add(targetObj);
    return () => {
      scene.remove(targetObj);
    };
  }, [scene, targetObj]);

  useEffect(() => () => beamGeoms.dispose(), [beamGeoms]);

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
          radius: MOVE_RADIUS,
          downbeatBoost: 1.8,
          minDistance: 1.2,
          currentX: m.currentX,
          currentZ: m.currentZ,
          isDownbeat,
        });
        m.targetX = offset.x;
        m.targetZ = offset.z;
        m.lastBeatMs = beatMs;
      }
      const a = exponentialAlpha(delta, MOVE_TAU);
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

    const lighting = useStore.getState().lighting;
    const beatMs = lighting.lastBeatTimeMs ?? 0;
    const patIdx = patternIndex(fixtureSeed, lighting.lastDownbeatTimeMs, PATTERN_COUNT);
    const step = patternStep(beatMs, 8);
    const beams = beamsRef.current;
    if (beams) {
      const half = (beamCount - 1) / 2;
      beams.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        let yaw = 0;
        if (patIdx === 0) {
          yaw = ((i - half) / Math.max(1, half)) * (fanAngleRad / 2);
        } else if (patIdx === 1) {
          yaw = ((i - half) / Math.max(1, half)) * fanAngleRad * Math.sin(step * 0.4);
        } else {
          yaw = (i / beamCount) * Math.PI * 2 * (step / 8) + i * 0.2;
        }
        mesh.rotation.set(0, yaw, 0);
        mesh.scale.set(beamLength, beamLength, beamLength);
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const render = mapLightingFrame(instance, definition, smoothed.current, colorScratch);
        const c = render.color.clone();
        c.setHSL(c.getHSL({ h: 0, s: 0, l: 0 }).h, 1, 0.55);
        mat.color.copy(c);
        mat.opacity = render.intensity > 0 ? Math.min(0.9, render.intensity * 0.85) : 0;
      });
    }
  });

  const handlers = fixturePointerHandlers(instance.id, onSelect, onHover);
  const beamEls = useMemo(
    () =>
      Array.from({ length: beamCount }, (_, i) => (
        <mesh key={i} geometry={beamGeoms} position={[0, 0, -0.1]} raycast={() => null}>
          <meshBasicMaterial
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )),
    [beamCount, beamGeoms],
  );

  return (
    <group
      ref={groupRef}
      position={instance.position}
      rotation={instance.rotation}
      {...handlers}
    >
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.2, 0.1, 0.2]} />
        <meshStandardMaterial color={selected ? SELECTED_TINT : '#1e293b'} metalness={0.6} />
      </mesh>
      <group ref={headRef} position={[0, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.14, 0.1, 0.14]} />
          <meshStandardMaterial color="#0f172a" emissive="#22d3ee" emissiveIntensity={0.2} />
        </mesh>
        <group ref={beamsRef}>{beamEls}</group>
      </group>
      {hovered && !selected && (
        <mesh raycast={() => null}>
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshBasicMaterial color={HOVER_TINT} wireframe />
        </mesh>
      )}
    </group>
  );
}
