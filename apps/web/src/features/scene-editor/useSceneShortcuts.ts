import { useEffect } from 'react';
import { useStore } from '@/store';

function isEditableTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

export function useSceneShortcuts() {
  const dispatch = useStore((s) => s.sceneDispatch);
  const undo = useStore((s) => s.sceneUndo);
  const redo = useStore((s) => s.sceneRedo);
  const setPlacement = useStore((s) => s.editorSetPlacement);
  const setStructurePlacement = useStore((s) => s.editorSetStructurePlacement);
  const newFixtureId = useStore((s) => s.newFixtureId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      const doc = useStore.getState().scene.doc;
      const selectedFixtureId = doc.selectedFixtureId;
      const selectedStructureId = doc.selectedStructureId;
      const selectedFixture = doc.fixtures.find((f) => f.id === selectedFixtureId);

      if (e.key === 'Escape') {
        setPlacement(null);
        setStructurePlacement(null);
        dispatch({ type: 'selection.set', id: null });
        dispatch({ type: 'structure.select', id: null });
        return;
      }

      if (e.key.toLowerCase() === 'u' && selectedFixture?.mount) {
        e.preventDefault();
        dispatch({ type: 'fixture.unmount', id: selectedFixture.id });
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStructureId) {
        e.preventDefault();
        dispatch({ type: 'structure.remove', id: selectedStructureId });
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFixtureId) {
        e.preventDefault();
        dispatch({ type: 'fixture.remove', id: selectedFixtureId });
        return;
      }

      if (mod && e.key.toLowerCase() === 'd' && selectedStructureId) {
        e.preventDefault();
        dispatch({
          type: 'structure.duplicate',
          id: selectedStructureId,
          newId: newFixtureId(),
        });
        return;
      }

      if (mod && e.key.toLowerCase() === 'd' && selectedFixtureId) {
        e.preventDefault();
        dispatch({
          type: 'fixture.duplicate',
          id: selectedFixtureId,
          newId: newFixtureId(),
        });
        return;
      }

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, undo, redo, setPlacement, setStructurePlacement, newFixtureId]);
}
