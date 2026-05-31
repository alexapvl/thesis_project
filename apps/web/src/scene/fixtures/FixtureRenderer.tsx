import { useState, type ComponentType } from 'react';
import { BUILTIN_FIXTURES, type FixtureInstance, type FixtureKind } from '@stl/fixtures';
import { useStore } from '@/store';
import { SpotFixture } from './SpotFixture';
import { PointFixture } from './PointFixture';
import { WashFixture } from './WashFixture';
import { BeamFixture } from './BeamFixture';
import { LaserFixture } from './LaserFixture';
import { ParFixture } from './ParFixture';
import { BlinderFixture } from './BlinderFixture';
import { StrobeFixture } from './StrobeFixture';
import { BarFixture } from './BarFixture';
import { MatrixFixture } from './MatrixFixture';
import type { FixtureInteractionProps } from './fixture-interaction';

type FixtureComponent = ComponentType<
  FixtureInteractionProps & { instance: FixtureInstance }
>;

const FIXTURE_BY_KIND: Record<FixtureKind, FixtureComponent> = {
  spot: SpotFixture,
  point: PointFixture,
  wash: WashFixture,
  beam: BeamFixture,
  laser: LaserFixture,
  par: ParFixture,
  blinder: BlinderFixture,
  strobe: StrobeFixture,
  bar: BarFixture,
  matrix: MatrixFixture,
};

export function FixtureRenderer() {
  const fixtures = useStore((s) => s.scene.doc.fixtures);
  const selectedId = useStore((s) => s.scene.doc.selectedFixtureId);
  const dispatch = useStore((s) => s.sceneDispatch);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <>
      {fixtures.map((inst) => {
        const def = BUILTIN_FIXTURES.find((d) => d.typeId === inst.definitionId);
        const Component = def ? FIXTURE_BY_KIND[def.kind] : SpotFixture;
        const selected = inst.id === selectedId;
        const hovered = inst.id === hoveredId;
        const onSelect = (id: string) => dispatch({ type: 'selection.set', id });
        const onHover = (id: string | null) => setHoveredId(id);
        return (
          <Component
            key={inst.id}
            instance={inst}
            selected={selected}
            hovered={hovered}
            onSelect={onSelect}
            onHover={onHover}
          />
        );
      })}
    </>
  );
}
