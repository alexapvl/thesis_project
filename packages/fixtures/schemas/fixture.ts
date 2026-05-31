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
  /** Default placement Y when dropped on the floor. */
  mountHeight: z.number().optional(),
  /** Fixture has an aim target and shows the target handle gizmo. */
  aims: z.boolean().optional(),
  defaultProps: z.record(z.string(), z.unknown()),
});
export type FixtureDefinition = z.infer<typeof fixtureDefinitionSchema>;

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
  overrides: z.record(z.string(), z.unknown()),
});
export type FixtureInstance = z.infer<typeof fixtureInstanceSchema>;

export const fixtureGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  fixtureIds: z.array(z.string()),
});
export type FixtureGroup = z.infer<typeof fixtureGroupSchema>;

/** Resolved placement metadata for a fixture definition. */
export function fixturePlacementMeta(def: FixtureDefinition): { mountHeight: number; aims: boolean } {
  const mountHeight = def.mountHeight ?? (def.aims ? 4 : 2);
  const aims =
    def.aims ??
    (def.kind === 'spot' ||
      def.kind === 'wash' ||
      def.kind === 'beam' ||
      def.kind === 'laser');
  return { mountHeight, aims };
}
