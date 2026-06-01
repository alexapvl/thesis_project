/**
 * Generates the bundled stage presets as validated SceneDocument JSON.
 *
 * Why a script instead of hand-written JSON: fixtures attach to truss via
 * generated socket IDs (e.g. `gp-top-beam-under-9`, `tower-zp-6`). Computing
 * the world pose + aim target with the project's own socket math guarantees
 * the mounts resolve and the aim matches a freshly dragged-on fixture. Every
 * fixture is validated (resolveMountTransform must succeed) and the whole doc
 * is parsed through the zod schema before it is written.
 *
 * Run: pnpm --filter web gen:stages
 *
 * Convention: stage/DJ at the back (-Z), audience/dancefloor at the front
 * (+Z). Fixtures on a structure's +Z face therefore throw light over the
 * crowd; under-beam fixtures point straight down at the stage.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUILTIN_FIXTURES,
  fixturePlacementMeta,
  parseSceneDocument,
  type FixtureInstance,
  type SceneDocument,
  type StructureInstance,
} from '@stl/fixtures';
import { aimPointFromMount, resolveMountTransform } from '../src/scene/structures/sockets';

type Vec3 = [number, number, number];

const round = (n: number): number => Math.round(n * 1e4) / 1e4;
const roundVec = (v: readonly number[]): Vec3 => [round(v[0]!), round(v[1]!), round(v[2]!)];

function tower(id: string, position: Vec3, height: number, name: string): StructureInstance {
  return {
    id,
    definitionId: 'builtin.structure.tower',
    name,
    kind: 'tower',
    position,
    rotation: [0, 0, 0],
    dims: { height },
  };
}

function goalpost(
  id: string,
  position: Vec3,
  span: number,
  height: number,
  name: string,
): StructureInstance {
  return {
    id,
    definitionId: 'builtin.structure.goalpost',
    name,
    kind: 'goalpost',
    position,
    rotation: [0, 0, 0],
    dims: { span, height },
  };
}

type StageBuilder = {
  structures: StructureInstance[];
  fixtures: FixtureInstance[];
  mount: (
    defId: string,
    structureId: string,
    socketId: string,
    name: string,
    overrides?: Record<string, unknown>,
  ) => void;
};

function builder(structures: StructureInstance[]): StageBuilder {
  const fixtures: FixtureInstance[] = [];
  let counter = 0;
  return {
    structures,
    fixtures,
    mount(defId, structureId, socketId, name, overrides = {}) {
      const structure = structures.find((s) => s.id === structureId);
      if (!structure) throw new Error(`unknown structure "${structureId}"`);
      const resolved = resolveMountTransform(structure, socketId);
      if (!resolved) {
        throw new Error(
          `socket "${socketId}" does not exist on ${structure.kind} "${structureId}"`,
        );
      }
      const def = BUILTIN_FIXTURES.find((d) => d.typeId === defId);
      if (!def) throw new Error(`unknown fixture definition "${defId}"`);
      const aims = fixturePlacementMeta(def).aims;
      const target: Vec3 = aims
        ? roundVec(aimPointFromMount(resolved.position, resolved.normal))
        : roundVec(resolved.position);
      counter += 1;
      fixtures.push({
        id: `${structureId}-${def.kind}-${counter}`,
        definitionId: defId,
        name,
        enabled: true,
        position: roundVec(resolved.position),
        rotation: roundVec(resolved.rotation),
        target,
        groupId: null,
        mount: { structureId, socketId },
        overrides,
      });
    },
  };
}

function finalize(
  id: string,
  name: string,
  b: StageBuilder,
): SceneDocument {
  const doc = {
    schemaVersion: '1.0.0',
    id,
    name,
    fixtures: b.fixtures,
    groups: [],
    structures: b.structures,
    selectedFixtureId: null,
    selectedStructureId: null,
  };
  const parsed = parseSceneDocument(doc);
  if (!parsed.ok) throw new Error(`scene "${id}" failed schema validation: ${parsed.error}`);
  return parsed.value;
}

const F = {
  spot: 'builtin.spot',
  wash: 'builtin.wash',
  beam: 'builtin.beam',
  laser: 'builtin.laser',
  par: 'builtin.par',
  blinder: 'builtin.blinder',
  strobe: 'builtin.strobe',
  bar: 'builtin.bar',
  matrix: 'builtin.matrix',
} as const;

/* ------------------------------------------------------------------ *
 * Simple stage — "Club Night"
 * One overhead arch over the DJ, two flanking towers.
 * ------------------------------------------------------------------ */
function buildSimple(): SceneDocument {
  const arch = goalpost('st-arch', [0, 0, -5], 6, 4, 'DJ arch');
  const towerL = tower('st-tower-l', [-5, 0, -4], 4, 'Tower left');
  const towerR = tower('st-tower-r', [5, 0, -4], 4, 'Tower right');
  const b = builder([arch, towerL, towerR]);

  // Arch top beam: spots straight down on the DJ, beams out over the crowd.
  b.mount(F.spot, 'st-arch', 'gp-top-beam-under-2', 'Arch spot L');
  b.mount(F.spot, 'st-arch', 'gp-top-beam-under-9', 'Arch spot R');
  b.mount(F.beam, 'st-arch', 'gp-top-beam-zp-2', 'Arch beam L');
  b.mount(F.beam, 'st-arch', 'gp-top-beam-zp-9', 'Arch beam R');
  b.mount(F.bar, 'st-arch', 'gp-top-beam-under-5', 'Arch LED bar');

  // Arch legs facing the crowd: PARs high, blinders lower.
  b.mount(F.par, 'st-arch', 'gp-l-tower-zp-5', 'Leg PAR L');
  b.mount(F.par, 'st-arch', 'gp-r-tower-zp-5', 'Leg PAR R');
  b.mount(F.blinder, 'st-arch', 'gp-l-tower-zp-2', 'Leg blinder L');
  b.mount(F.blinder, 'st-arch', 'gp-r-tower-zp-2', 'Leg blinder R');

  // Side towers: wash high, beam mid, both facing the crowd.
  b.mount(F.wash, 'st-tower-l', 'tower-zp-6', 'Tower L wash');
  b.mount(F.beam, 'st-tower-l', 'tower-zp-4', 'Tower L beam');
  b.mount(F.wash, 'st-tower-r', 'tower-zp-6', 'Tower R wash');
  b.mount(F.beam, 'st-tower-r', 'tower-zp-4', 'Tower R beam');

  return finalize('stage-simple-club', 'Club Night (simple)', b);
}

/* ------------------------------------------------------------------ *
 * Complex stage — "EDM Festival" (moderate density)
 * Back wall of 4 towers (video-wall feel), a wide main arch, two tall
 * side towers with lasers.
 * ------------------------------------------------------------------ */
function buildFestival(): SceneDocument {
  const mainArch = goalpost('st-mainarch', [0, 0, -6], 10, 6, 'Main arch');
  const bw1 = tower('st-bw-1', [-6, 0, -7], 5, 'Backwall 1');
  const bw2 = tower('st-bw-2', [-2, 0, -7], 5, 'Backwall 2');
  const bw3 = tower('st-bw-3', [2, 0, -7], 5, 'Backwall 3');
  const bw4 = tower('st-bw-4', [6, 0, -7], 5, 'Backwall 4');
  const sideL = tower('st-side-l', [-8, 0, -3], 6, 'Side tower left');
  const sideR = tower('st-side-r', [8, 0, -3], 6, 'Side tower right');
  const b = builder([mainArch, bw1, bw2, bw3, bw4, sideL, sideR]);

  // Back wall: pixel matrix + LED bar facing the crowd, beam up top.
  for (const id of ['st-bw-1', 'st-bw-2', 'st-bw-3', 'st-bw-4']) {
    b.mount(F.matrix, id, 'tower-zp-6', `${id} matrix`);
    b.mount(F.bar, id, 'tower-zp-3', `${id} bar`);
    b.mount(F.beam, id, 'tower-zp-9', `${id} beam`);
  }

  // Main arch top beam: spots down, beams over the crowd, strobes at the
  // ends, blinders in the centre.
  b.mount(F.spot, 'st-mainarch', 'gp-top-beam-under-4', 'Arch spot 1');
  b.mount(F.spot, 'st-mainarch', 'gp-top-beam-under-7', 'Arch spot 2');
  b.mount(F.spot, 'st-mainarch', 'gp-top-beam-under-12', 'Arch spot 3');
  b.mount(F.spot, 'st-mainarch', 'gp-top-beam-under-15', 'Arch spot 4');
  b.mount(F.beam, 'st-mainarch', 'gp-top-beam-zp-2', 'Arch beam 1');
  b.mount(F.beam, 'st-mainarch', 'gp-top-beam-zp-6', 'Arch beam 2');
  b.mount(F.beam, 'st-mainarch', 'gp-top-beam-zp-13', 'Arch beam 3');
  b.mount(F.beam, 'st-mainarch', 'gp-top-beam-zp-17', 'Arch beam 4');
  b.mount(F.strobe, 'st-mainarch', 'gp-top-beam-under-0', 'Arch strobe L');
  b.mount(F.strobe, 'st-mainarch', 'gp-top-beam-under-19', 'Arch strobe R');
  b.mount(F.blinder, 'st-mainarch', 'gp-top-beam-under-9', 'Arch blinder L');
  b.mount(F.blinder, 'st-mainarch', 'gp-top-beam-under-10', 'Arch blinder R');

  // Side towers: laser high, beam mid, spot lower — all over the crowd.
  b.mount(F.laser, 'st-side-l', 'tower-zp-10', 'Side L laser');
  b.mount(F.beam, 'st-side-l', 'tower-zp-7', 'Side L beam');
  b.mount(F.spot, 'st-side-l', 'tower-zp-4', 'Side L spot');
  b.mount(F.laser, 'st-side-r', 'tower-zp-10', 'Side R laser');
  b.mount(F.beam, 'st-side-r', 'tower-zp-7', 'Side R beam');
  b.mount(F.spot, 'st-side-r', 'tower-zp-4', 'Side R spot');

  return finalize('stage-edm-festival', 'EDM Festival (complex)', b);
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(here, '../src/stages');
  mkdirSync(outDir, { recursive: true });

  const stages: Array<[string, SceneDocument]> = [
    ['simple-club.json', buildSimple()],
    ['edm-festival.json', buildFestival()],
  ];

  for (const [file, doc] of stages) {
    const path = resolve(outDir, file);
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
    // eslint-disable-next-line no-console
    console.log(
      `wrote ${file}: ${doc.structures.length} structures, ${doc.fixtures.length} fixtures`,
    );
  }
}

main();
