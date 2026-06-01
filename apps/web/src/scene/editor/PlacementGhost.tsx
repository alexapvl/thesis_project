import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BUILTIN_FIXTURES,
  BUILTIN_STRUCTURES,
  fixturePlacementMeta,
  type FixtureKind,
  type StructureKind,
} from '@stl/fixtures';
import { useStore } from '@/store';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import {
  BeamHead,
  BeamStatic,
  FresnelSpotHead,
  FresnelSpotStatic,
  LedParWashHead,
  LedParWashStatic,
} from '@/scene/fixtures/bodies';
import { BeamStructure } from '@/scene/structures/BeamStructure';
import { GoalpostStructure } from '@/scene/structures/GoalpostStructure';
import { TowerStructure } from '@/scene/structures/TowerStructure';
import { BasePlateStructure } from '@/scene/structures/BasePlateStructure';
import { instantiateStructure } from '@/scene/structures/instantiateStructure';
import { composeRotation } from './composeRotation';
import { resolveFixtureDrop } from './resolveFixtureDrop';
import {
  clearStructurePlacement,
  rememberStructurePlacement,
  resolveStructureFloorPlacement,
} from './resolveStructurePlacement';

const WIREFRAME = '#fbbf24';
const wireframeMat = { color: WIREFRAME, wireframe: true, transparent: true, opacity: 0.85 };

/** Head pitched so lens (-Z) points at the default floor target below. */
const GHOST_HEAD_DOWN: [number, number, number] = [-Math.PI / 2, 0, 0];

const LASER_GHOST_BEAMS = 5;

function LaserGhostBeams() {
  const half = (LASER_GHOST_BEAMS - 1) / 2;
  return Array.from({ length: LASER_GHOST_BEAMS }, (_, i) => {
    const yaw = ((i - half) / Math.max(1, half)) * (Math.PI / 6);
    return (
      <mesh key={i} position={[0, 0, -0.1]} rotation={[Math.PI / 2, yaw, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.35, 6]} />
        <meshStandardMaterial {...wireframeMat} />
      </mesh>
    );
  });
}

function LaserGhostStatic() {
  return (
    <>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.2, 0.1, 0.2]} />
        <meshStandardMaterial {...wireframeMat} />
      </mesh>
      <group rotation={[-0.45, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.14, 0.1, 0.14]} />
          <meshStandardMaterial {...wireframeMat} />
        </mesh>
        <LaserGhostBeams />
      </group>
    </>
  );
}

function LaserGhostAiming({ target }: { target: THREE.Vector3 }) {
  const headRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const head = headRef.current;
    if (!head) return;
    head.lookAt(target);
    head.rotateY(Math.PI);
  });

  return (
    <>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.2, 0.1, 0.2]} />
        <meshStandardMaterial {...wireframeMat} />
      </mesh>
      <group ref={headRef}>
        <mesh>
          <boxGeometry args={[0.14, 0.1, 0.14]} />
          <meshStandardMaterial {...wireframeMat} />
        </mesh>
        <LaserGhostBeams />
      </group>
    </>
  );
}

function AimingBodyGhost({ kind }: { kind: FixtureKind }) {
  const staticPart =
    kind === 'spot' ? (
      <FresnelSpotStatic ghost />
    ) : kind === 'wash' ? (
      <LedParWashStatic ghost />
    ) : (
      <BeamStatic ghost />
    );
  const headPart =
    kind === 'spot' ? (
      <FresnelSpotHead ghost />
    ) : kind === 'wash' ? (
      <LedParWashHead ghost />
    ) : (
      <BeamHead ghost />
    );

  return (
    <>
      {staticPart}
      <group position={[0, 0.05, 0]} rotation={GHOST_HEAD_DOWN}>
        {headPart}
      </group>
    </>
  );
}

function AimingGhost({
  target,
  pos,
  kind,
}: {
  target: THREE.Vector3;
  pos: Vec3;
  kind: FixtureKind;
}) {
  return (
    <>
      {kind === 'laser' ? <LaserGhostAiming target={target} /> : <AimingBodyGhost kind={kind} />}
      <line>
        <bufferGeometry
          attach="geometry"
          ref={(geom) => {
            if (!geom) return;
            const pts = new Float32Array([
              0,
              0,
              0,
              target.x - pos[0],
              target.y - pos[1],
              target.z - pos[2],
            ]);
            geom.setAttribute('position', new THREE.BufferAttribute(pts, 3));
          }}
        />
        <lineBasicMaterial color={WIREFRAME} transparent opacity={0.4} />
      </line>
    </>
  );
}

function KindGhost({ kind }: { kind: FixtureKind }) {
  switch (kind) {
    case 'bar':
      return (
        <>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[1.7, 0.08, 0.08]} />
            <meshStandardMaterial {...wireframeMat} />
          </mesh>
          <mesh position={[0, 0, -0.06]}>
            <boxGeometry args={[1.5, 0.05, 0.02]} />
            <meshStandardMaterial {...wireframeMat} />
          </mesh>
        </>
      );
    case 'matrix':
      return (
        <>
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[1.48, 1.48, 0.06]} />
            <meshStandardMaterial {...wireframeMat} />
          </mesh>
          <mesh position={[0, 0, -0.05]}>
            <planeGeometry args={[1.2, 1.2]} />
            <meshStandardMaterial {...wireframeMat} />
          </mesh>
        </>
      );
    case 'blinder':
      return (
        <>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.5, 0.4, 0.08]} />
            <meshStandardMaterial {...wireframeMat} />
          </mesh>
          <mesh position={[0, 0, -0.12]}>
            <boxGeometry args={[0.45, 0.35, 0.04]} />
            <meshStandardMaterial {...wireframeMat} />
          </mesh>
        </>
      );
    case 'strobe':
      return (
        <>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.35, 0.28, 0.08]} />
            <meshStandardMaterial {...wireframeMat} />
          </mesh>
          <mesh position={[0, 0, -0.07]}>
            <planeGeometry args={[0.3, 0.22]} />
            <meshStandardMaterial {...wireframeMat} />
          </mesh>
        </>
      );
    case 'par':
      return (
        <>
          <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.17, 0.19, 0.1, 16]} />
            <meshStandardMaterial {...wireframeMat} />
          </mesh>
          <mesh position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.18, 16]} />
            <meshStandardMaterial {...wireframeMat} />
          </mesh>
        </>
      );
    case 'laser':
      return <LaserGhostStatic />;
    case 'point':
      return (
        <mesh>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial {...wireframeMat} />
        </mesh>
      );
    default:
      return (
        <mesh>
          <boxGeometry args={[0.3, 0.5, 0.3]} />
          <meshStandardMaterial {...wireframeMat} />
        </mesh>
      );
  }
}

function StructureGhost({ kind }: { kind: StructureKind }) {
  const sdef = BUILTIN_STRUCTURES.find((d) => d.kind === kind);
  if (!sdef) return null;
  const ghostInst = instantiateStructure(sdef, 'ghost', [0, 0, 0]);
  const props = {
    instance: ghostInst,
    selected: false,
    hovered: false,
    onSelect: () => {},
    onHover: () => {},
    wireframe: true as const,
  };
  switch (kind) {
    case 'tower':
      return <TowerStructure {...props} />;
    case 'beam':
      return <BeamStructure {...props} />;
    case 'goalpost':
      return <GoalpostStructure {...props} />;
    case 'baseplate':
      return <BasePlateStructure {...props} />;
    default:
      return null;
  }
}

type PreviewState =
  | { kind: 'structure'; pos: Vec3; structureKind: StructureKind }
  | {
      kind: 'fixture';
      pos: Vec3;
      rotation?: Vec3;
      onGround: boolean;
      fixtureKind: FixtureKind;
      aims: boolean;
      aimTarget?: Vec3;
    }
  | null;

export function PlacementGhost() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const pendingFixtureTypeId = useStore((s) => s.editor.pendingFixtureTypeId);
  const pendingStructureTypeId = useStore((s) => s.editor.pendingStructureTypeId);
  const structures = useStore((s) => s.scene.doc.structures);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);
  const pendingRotation = useStore((s) => s.editor.pendingRotation);

  const [preview, setPreview] = useState<PreviewState>(null);
  const overRef = useRef(false);

  useEffect(() => {
    const pendingTypeId = pendingStructureTypeId ?? pendingFixtureTypeId;
    if (!pendingTypeId) {
      setPreview(null);
      clearStructurePlacement();
      return;
    }
    const dom = gl.domElement;
    const isStructure = pendingStructureTypeId != null;

    const updateStructurePreview = (clientX: number, clientY: number) => {
      const sdef = BUILTIN_STRUCTURES.find((d) => d.typeId === pendingStructureTypeId);
      if (!sdef) return;
      const placement = resolveStructureFloorPlacement(
        dom,
        camera,
        clientX,
        clientY,
        gridSnap,
        gridSize,
      );
      if (!placement.ok) {
        setPreview(null);
        clearStructurePlacement();
        return;
      }
      rememberStructurePlacement(placement.pos);
      setPreview({ kind: 'structure', pos: placement.pos, structureKind: sdef.kind });
    };

    const onMove = (ev: MouseEvent) => {
      overRef.current = true;

      if (isStructure) {
        updateStructurePreview(ev.clientX, ev.clientY);
        return;
      }

      const def = BUILTIN_FIXTURES.find((d) => d.typeId === pendingFixtureTypeId);
      if (!def) return;
      const { groundRestHeight, aims } = fixturePlacementMeta(def);
      const drop = resolveFixtureDrop(
        dom,
        camera,
        ev.clientX,
        ev.clientY,
        structures,
        groundRestHeight,
      );
      if (drop.kind === 'none') {
        setPreview(null);
        return;
      }
      if (drop.kind === 'mount') {
        let pos = drop.position;
        if (gridSnap) pos = snapVec3(pos, gridSize);
        setPreview({
          kind: 'fixture',
          pos,
          rotation: drop.rotation,
          onGround: false,
          fixtureKind: def.kind,
          aims,
          aimTarget: drop.aimTarget,
        });
      } else {
        let pos = drop.position;
        if (gridSnap) pos = snapVec3(pos, gridSize);
        setPreview({
          kind: 'fixture',
          pos,
          onGround: true,
          fixtureKind: def.kind,
          aims,
        });
      }
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0 || !isStructure) return;
      updateStructurePreview(ev.clientX, ev.clientY);
    };

    const onLeave = () => {
      overRef.current = false;
      setPreview(null);
      if (isStructure) clearStructurePlacement();
    };

    dom.addEventListener('mousemove', onMove);
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('mouseleave', onLeave);
    return () => {
      dom.removeEventListener('mousemove', onMove);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('mouseleave', onLeave);
      clearStructurePlacement();
    };
  }, [
    pendingFixtureTypeId,
    pendingStructureTypeId,
    structures,
    gl,
    camera,
    gridSnap,
    gridSize,
  ]);

  if (!preview) return null;

  if (preview.kind === 'structure') {
    return (
      <group position={preview.pos} rotation={pendingRotation}>
        <StructureGhost kind={preview.structureKind} />
      </group>
    );
  }

  const { pos, fixtureKind, aims, onGround, aimTarget } = preview;
  const baseRot = preview.rotation ?? [0, 0, 0];
  const rot = composeRotation(baseRot, pendingRotation);
  const target = aims
    ? onGround
      ? new THREE.Vector3(pos[0] + 4, pos[1] + 2, pos[2])
      : aimTarget
        ? new THREE.Vector3(aimTarget[0], aimTarget[1], aimTarget[2])
        : new THREE.Vector3(pos[0], 0, pos[2])
    : null;
  return (
    <group position={pos} rotation={rot}>
      {aims && target ? (
        <AimingGhost target={target} pos={pos} kind={fixtureKind} />
      ) : (
        <KindGhost kind={fixtureKind} />
      )}
    </group>
  );
}
