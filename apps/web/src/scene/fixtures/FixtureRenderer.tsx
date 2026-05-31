import { useState } from 'react';
import { BUILTIN_FIXTURES } from '@stl/fixtures';
import { useStore } from '@/store';
import { SpotFixture } from './SpotFixture';
import { PointFixture } from './PointFixture';

export function FixtureRenderer() {
  const fixtures = useStore((s) => s.scene.doc.fixtures);
  const selectedId = useStore((s) => s.scene.doc.selectedFixtureId);
  const dispatch = useStore((s) => s.sceneDispatch);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <>
      {fixtures.map((inst) => {
        const def = BUILTIN_FIXTURES.find((d) => d.typeId === inst.definitionId);
        const selected = inst.id === selectedId;
        const hovered = inst.id === hoveredId;
        const onSelect = (id: string) => dispatch({ type: 'selection.set', id });
        const onHover = (id: string | null) => setHoveredId(id);
        if (def?.kind === 'point') {
          return (
            <PointFixture
              key={inst.id}
              instance={inst}
              selected={selected}
              hovered={hovered}
              onSelect={onSelect}
              onHover={onHover}
            />
          );
        }
        return (
          <SpotFixture
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