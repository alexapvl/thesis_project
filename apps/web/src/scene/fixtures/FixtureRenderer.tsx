import { BUILTIN_FIXTURES } from '@stl/fixtures';
import { useStore } from '@/store';
import { SpotFixture } from './SpotFixture';
import { PointFixture } from './PointFixture';

export function FixtureRenderer() {
  const fixtures = useStore((s) => s.scene.doc.fixtures);
  const selectedId = useStore((s) => s.scene.doc.selectedFixtureId);
  const dispatch = useStore((s) => s.sceneDispatch);

  return (
    <>
      {fixtures.map((inst) => {
        const def = BUILTIN_FIXTURES.find((d) => d.typeId === inst.definitionId);
        const selected = inst.id === selectedId;
        const onSelect = (id: string) => dispatch({ type: 'selection.set', id });
        if (def?.kind === 'point') {
          return <PointFixture key={inst.id} instance={inst} selected={selected} onSelect={onSelect} />;
        }
        return <SpotFixture key={inst.id} instance={inst} selected={selected} onSelect={onSelect} />;
      })}
    </>
  );
}