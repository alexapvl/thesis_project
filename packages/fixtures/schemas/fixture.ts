import { z } from 'zod';

export const fixtureKindSchema = z.enum([
  'spot',
  'point',
  'wash',
  'beam',
  'laser',
  'par',
  'blinder',
  'strobe',
  'bar',
  'matrix',
]);
export type FixtureKind = z.infer<typeof fixtureKindSchema>;

export const fixtureDefinitionSchema = z.object({
  typeId: z.string(),
  label: z.string(),
  kind: fixtureKindSchema,
  /** Legacy default Y (deprecated for placement; use groundRestHeight). */
  mountHeight: z.number().optional(),
  /** Body center Y when resting on the floor. */
  groundRestHeight: z.number().optional(),
  /** Fixture has an aim target and shows the target handle gizmo. */
  aims: z.boolean().optional(),
  defaultProps: z.record(z.string(), z.unknown()),
});
export type FixtureDefinition = z.infer<typeof fixtureDefinitionSchema>;

import { fixtureMountSchema } from './structure';

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const fixtureInstanceSchema = z.object({
  id: z.string(),
  definitionId: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  position: vec3,
  rotation: vec3,
  target: vec3,
  groupId: z.string().nullable(),
  mount: fixtureMountSchema.nullable().default(null),
  overrides: z.record(z.string(), z.unknown()),
});
export type FixtureInstance = z.infer<typeof fixtureInstanceSchema>;

export const fixtureGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  fixtureIds: z.array(z.string()),
});
export type FixtureGroup = z.infer<typeof fixtureGroupSchema>;

const DEFAULT_GROUND_REST: Record<FixtureKind, number> = {
  spot: 0.28,
  wash: 0.28,
  beam: 0.32,
  laser: 0.3,
  par: 0.11,
  blinder: 0.22,
  strobe: 0.16,
  bar: 0.06,
  matrix: 0.05,
  point: 0.18,
};

/** Resolved placement metadata for a fixture definition. */
export function fixturePlacementMeta(def: FixtureDefinition): {
  mountHeight: number;
  groundRestHeight: number;
  aims: boolean;
} {
  const mountHeight = def.mountHeight ?? (def.aims ? 4 : 2);
  const groundRestHeight = def.groundRestHeight ?? DEFAULT_GROUND_REST[def.kind];
  const aims =
    def.aims ??
    (def.kind === 'spot' ||
      def.kind === 'wash' ||
      def.kind === 'beam' ||
      def.kind === 'laser');
  return { mountHeight, groundRestHeight, aims };
}
