import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
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
import { raycastFloor } from './raycastFloor';

const WIREFRAME = '#fbbf24';
const wireframeMat = { color: WIREFRAME, wireframe: true, transparent: true, opacity: 0.85 };

/** Head pitched so lens (-Z) points at the default floor target below. */
const GHOST_HEAD_DOWN: [number, number, number] = [-Math.PI / 2, 0, 0];

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
      <AimingBodyGhost kind={kind} />
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
        <mesh>
          <boxGeometry args={[1.6, 0.12, 0.12]} />
          <meshStandardMaterial {...wireframeMat} />
        </mesh>
      );
    case 'matrix':
      return (
        <mesh>
          <boxGeometry args={[1.4, 0.1, 1.4]} />
          <meshStandardMaterial {...wireframeMat} />
        </mesh>
      );
    case 'blinder':
      return (
        <mesh>
          <boxGeometry args={[0.5, 0.4, 0.1]} />
          <meshStandardMaterial {...wireframeMat} />
        </mesh>
      );
    case 'strobe':
      return (
        <mesh>
          <boxGeometry args={[0.35, 0.28, 0.12]} />
          <meshStandardMaterial {...wireframeMat} />
        </mesh>
      );
    case 'par':
      return (
        <mesh rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.18, 0.22, 16]} />
          <meshStandardMaterial {...wireframeMat} />
        </mesh>
      );
    case 'laser':
      return (
        <mesh>
          <boxGeometry args={[0.2, 0.15, 0.2]} />
          <meshStandardMaterial {...wireframeMat} />
        </mesh>
      );
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
  | { kind: 'fixture'; pos: Vec3; rotation?: Vec3; onGround: boolean; fixtureKind: FixtureKind; aims: boolean }
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
      return;
    }
    const dom = gl.domElement;
    const isStructure = pendingStructureTypeId != null;

    const onMove = (ev: MouseEvent) => {
      overRef.current = true;

      if (isStructure) {
        const sdef = BUILTIN_STRUCTURES.find((d) => d.typeId === pendingStructureTypeId);
        if (!sdef) return;
        const r = raycastFloor(dom, camera, ev.clientX, ev.clientY);
        if (!r.ok) {
          setPreview(null);
          return;
        }
        let pos: Vec3 = [r.point[0], 0, r.point[2]];
        if (gridSnap) pos = snapVec3(pos, gridSize);
        setPreview({ kind: 'structure', pos, structureKind: sdef.kind });
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

    const onLeave = () => {
      overRef.current = false;
      setPreview(null);
    };

    dom.addEventListener('mousemove', onMove);
    dom.addEventListener('mouseleave', onLeave);
    return () => {
      dom.removeEventListener('mousemove', onMove);
      dom.removeEventListener('mouseleave', onLeave);
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

  const { pos, fixtureKind, aims, onGround } = preview;
  const baseRot = preview.rotation ?? [0, 0, 0];
  const rot = composeRotation(baseRot, pendingRotation);
  const target = aims
    ? onGround
      ? new THREE.Vector3(pos[0] + 4, pos[1] + 2, pos[2])
      : new THREE.Vector3(pos[0], 0, pos[2])
    : null;
  const isKnownAiming =
    fixtureKind === 'spot' || fixtureKind === 'wash' || fixtureKind === 'beam';

  return (
    <group position={pos} rotation={rot}>
      {aims && target && isKnownAiming ? (
        <AimingGhost target={target} pos={pos} kind={fixtureKind} />
      ) : aims && target ? (
        <AimingGhost target={target} pos={pos} kind="spot" />
      ) : (
        <KindGhost kind={fixtureKind} />
      )}
    </group>
  );
}
