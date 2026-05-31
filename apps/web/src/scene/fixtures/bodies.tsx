import type { RefObject } from 'react';

function lensRef(ref: RefObject<THREE.MeshStandardMaterial | null> | undefined) {
  return ref as unknown as RefObject<THREE.MeshStandardMaterial> | undefined;
}
import * as THREE from 'three';
import { SELECTED_TINT } from './fixture-interaction';

const GHOST_COLOR = '#fbbf24';
const BODY = '#1e293b';
const MOUNT = '#334155';
const BASE = '#475569';
const ARM = '#334155';
const HEAD = '#1e293b';
const BARN = '#0f172a';

type BodyProps = {
  ghost?: boolean;
  selected?: boolean;
  lensMatRef?: RefObject<THREE.MeshStandardMaterial | null>;
};

function stdProps(ghost: boolean | undefined, selected: boolean | undefined, base: string) {
  if (ghost) {
    return { color: GHOST_COLOR, transparent: true, opacity: 0.5, metalness: 0.2, roughness: 0.6 };
  }
  return {
    color: selected ? SELECTED_TINT : base,
    metalness: 0.4,
    roughness: 0.6,
  };
}

/** 18 LED lens centers on the wash face (x, y in head local space, z = front). */
export const WASH_LED_OFFSETS: ReadonlyArray<readonly [number, number]> = (() => {
  const out: [number, number][] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    out.push([Math.cos(a) * 0.2, Math.sin(a) * 0.2]);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    out.push([Math.cos(a) * 0.1, Math.sin(a) * 0.1]);
  }
  return out;
})();

// --- Beam (unchanged moving-head silhouette) ---

export function BeamStatic({ ghost, selected }: BodyProps) {
  const m = stdProps(ghost, selected, BASE);
  return (
    <>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.12, 20]} />
        <meshStandardMaterial {...m} />
      </mesh>
      <mesh position={[-0.2, 0, 0]}>
        <boxGeometry args={[0.05, 0.36, 0.08]} />
        <meshStandardMaterial {...stdProps(ghost, selected, ARM)} metalness={0.3} />
      </mesh>
      <mesh position={[0.2, 0, 0]}>
        <boxGeometry args={[0.05, 0.36, 0.08]} />
        <meshStandardMaterial {...stdProps(ghost, selected, ARM)} metalness={0.3} />
      </mesh>
    </>
  );
}

export function BeamHead({ ghost, lensMatRef }: BodyProps) {
  const headMat = ghost
    ? { color: GHOST_COLOR, transparent: true, opacity: 0.5, metalness: 0.5, roughness: 0.4 }
    : { color: HEAD, metalness: 0.5, roughness: 0.4 };
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.42, 20]} />
        <meshStandardMaterial {...headMat} />
      </mesh>
      <mesh position={[0, 0, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.04, 20]} />
        {ghost ? (
          <meshStandardMaterial color={GHOST_COLOR} transparent opacity={0.5} />
        ) : (
          <meshStandardMaterial ref={lensRef(lensMatRef)} color={HEAD} />
        )}
      </mesh>
    </>
  );
}

// --- Fresnel spotlight ---

export function FresnelSpotStatic({ ghost, selected }: BodyProps) {
  const m = stdProps(ghost, selected, MOUNT);
  return (
    <>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.42, 0.06, 0.36]} />
        <meshStandardMaterial {...m} metalness={0.35} />
      </mesh>
      <mesh position={[-0.24, 0.02, 0]}>
        <boxGeometry args={[0.04, 0.38, 0.06]} />
        <meshStandardMaterial {...m} />
      </mesh>
      <mesh position={[0.24, 0.02, 0]}>
        <boxGeometry args={[0.04, 0.38, 0.06]} />
        <meshStandardMaterial {...m} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.12, 0.04, 0.08]} />
        <meshStandardMaterial {...m} />
      </mesh>
    </>
  );
}

function BarnDoor({
  position,
  rotation,
  args,
  ghost,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  args: [number, number, number];
  ghost?: boolean;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={ghost ? GHOST_COLOR : BARN}
        transparent={ghost}
        opacity={ghost ? 0.5 : 1}
        metalness={0.5}
        roughness={0.4}
      />
    </mesh>
  );
}

export function FresnelSpotHead({ ghost, lensMatRef }: BodyProps) {
  const housing = ghost
    ? { color: GHOST_COLOR, transparent: true, opacity: 0.5, metalness: 0.4, roughness: 0.55 }
    : { color: BODY, metalness: 0.45, roughness: 0.55 };
  return (
    <>
      <mesh position={[0, 0, -0.08]}>
        <boxGeometry args={[0.48, 0.4, 0.44]} />
        <meshStandardMaterial {...housing} />
      </mesh>
      <mesh position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.05, 32]} />
        {ghost ? (
          <meshStandardMaterial color={GHOST_COLOR} transparent opacity={0.55} />
        ) : (
          <meshStandardMaterial ref={lensRef(lensMatRef)} color={HEAD} metalness={0.3} roughness={0.35} />
        )}
      </mesh>
      {!ghost && (
        <mesh position={[0, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.08, 0.24, 32]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} transparent opacity={0.35} />
        </mesh>
      )}
      <BarnDoor
        position={[0, 0.3, -0.28]}
        rotation={[0.55, 0, 0]}
        args={[0.34, 0.02, 0.14]}
        ghost={ghost}
      />
      <BarnDoor
        position={[0, -0.3, -0.28]}
        rotation={[-0.55, 0, 0]}
        args={[0.34, 0.02, 0.14]}
        ghost={ghost}
      />
      <BarnDoor
        position={[0.3, 0, -0.28]}
        rotation={[0, 0, 0.55]}
        args={[0.14, 0.02, 0.34]}
        ghost={ghost}
      />
      <BarnDoor
        position={[-0.3, 0, -0.28]}
        rotation={[0, 0, -0.55]}
        args={[0.14, 0.02, 0.34]}
        ghost={ghost}
      />
    </>
  );
}

// --- LED PAR wash ---

export function LedParWashStatic({ ghost, selected }: BodyProps) {
  const m = stdProps(ghost, selected, MOUNT);
  return (
    <>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.36, 0.05, 0.28]} />
        <meshStandardMaterial {...m} />
      </mesh>
      <mesh position={[-0.22, 0, 0]}>
        <boxGeometry args={[0.04, 0.32, 0.05]} />
        <meshStandardMaterial {...m} />
      </mesh>
      <mesh position={[0.22, 0, 0]}>
        <boxGeometry args={[0.04, 0.32, 0.05]} />
        <meshStandardMaterial {...m} />
      </mesh>
      <mesh position={[-0.22, -0.12, 0.04]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 12]} />
        <meshStandardMaterial {...m} />
      </mesh>
      <mesh position={[0.22, -0.12, 0.04]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 12]} />
        <meshStandardMaterial {...m} />
      </mesh>
    </>
  );
}

type WashHeadProps = BodyProps & { lensMaterial?: THREE.MeshStandardMaterial };

export function LedParWashHead({ ghost, lensMaterial }: WashHeadProps) {
  const can = ghost
    ? { color: GHOST_COLOR, transparent: true, opacity: 0.5, metalness: 0.35, roughness: 0.5 }
    : { color: BODY, metalness: 0.4, roughness: 0.5 };
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.2, 24]} />
        <meshStandardMaterial {...can} />
      </mesh>
      <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.04, 24]} />
        <meshStandardMaterial {...can} />
      </mesh>
      <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 32]} />
        <meshStandardMaterial color={ghost ? GHOST_COLOR : '#0f172a'} transparent={ghost} opacity={ghost ? 0.4 : 1} />
      </mesh>
      {WASH_LED_OFFSETS.map(([x, y], i) => (
        <mesh key={i} position={[x, y, -0.13]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.02, 10]} />
          {ghost ? (
            <meshStandardMaterial color={GHOST_COLOR} transparent opacity={0.6} />
          ) : lensMaterial ? (
            <primitive object={lensMaterial} attach="material" />
          ) : (
            <meshStandardMaterial color={HEAD} />
          )}
        </mesh>
      ))}
    </>
  );
}
