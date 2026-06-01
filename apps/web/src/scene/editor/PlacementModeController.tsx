import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {
  BUILTIN_FIXTURES,
  BUILTIN_STRUCTURES,
  fixturePlacementMeta,
} from '@stl/fixtures';
import { useStore } from '@/store';
import { instantiateFixture } from '@/scene/fixtures/instantiate';
import { instantiateStructure } from '@/scene/structures/instantiateStructure';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { composeRotation } from './composeRotation';
import { resolveFixtureDrop } from './resolveFixtureDrop';
import {
  clearStructurePlacement,
  peekStructurePlacement,
  rememberStructurePlacement,
  resolveStructureFloorPlacement,
} from './resolveStructurePlacement';

function isEditableTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

export function PlacementModeController() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const pendingFixtureTypeId = useStore((s) => s.editor.pendingFixtureTypeId);
  const pendingStructureTypeId = useStore((s) => s.editor.pendingStructureTypeId);
  const structures = useStore((s) => s.scene.doc.structures);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);
  const dispatch = useStore((s) => s.sceneDispatch);
  const newFixtureId = useStore((s) => s.newFixtureId);
  const setPlacement = useStore((s) => s.editorSetPlacement);
  const setStructurePlacement = useStore((s) => s.editorSetStructurePlacement);
  const rotatePending = useStore((s) => s.editorRotatePending);
  const debugLog = useStore((s) => s.debugLog);

  const pendingTypeId = pendingStructureTypeId ?? pendingFixtureTypeId;

  useEffect(() => {
    if (!pendingTypeId) return;

    const isStructure = pendingStructureTypeId != null;
    const fixtureDef = !isStructure
      ? BUILTIN_FIXTURES.find((d) => d.typeId === pendingTypeId)
      : undefined;
    const structureDef = isStructure
      ? BUILTIN_STRUCTURES.find((d) => d.typeId === pendingTypeId)
      : undefined;

    if (!fixtureDef && !structureDef) {
      debugLog('warn', `unknown placement typeId: ${pendingTypeId}`);
      setPlacement(null);
      setStructurePlacement(null);
      return;
    }

    const dom = gl.domElement;

    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r') return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      rotatePending(e.shiftKey ? 'tilt' : 'yaw');
    };

    const syncStructurePlacement = (clientX: number, clientY: number) => {
      const placement = resolveStructureFloorPlacement(
        dom,
        camera,
        clientX,
        clientY,
        gridSnap,
        gridSize,
      );
      if (placement.ok) rememberStructurePlacement(placement.pos);
      return placement;
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0 || !structureDef) return;
      syncStructurePlacement(ev.clientX, ev.clientY);
    };

    const onClick = (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      const pendingRotation = useStore.getState().editor.pendingRotation;

      if (structureDef) {
        let pos: Vec3 | null = peekStructurePlacement();
        if (!pos) {
          const placement = syncStructurePlacement(ev.clientX, ev.clientY);
          if (!placement.ok) {
            debugLog('warn', `placement skipped: ${placement.reason} (tilt the camera down)`);
            return;
          }
          pos = placement.pos;
        }
        const inst = instantiateStructure(structureDef, newFixtureId(), pos, pendingRotation);
        dispatch({ type: 'structure.add', structure: inst });
        debugLog('info', `placed ${structureDef.label} at ${pos.map((n) => n.toFixed(2)).join(', ')}`);
        clearStructurePlacement();
        setStructurePlacement(null);
        return;
      }

      if (fixtureDef) {
        const { groundRestHeight } = fixturePlacementMeta(fixtureDef);
        const drop = resolveFixtureDrop(
          dom,
          camera,
          ev.clientX,
          ev.clientY,
          structures,
          groundRestHeight,
        );
        if (drop.kind === 'none') {
          debugLog('warn', `placement skipped: ${drop.reason}`);
          return;
        }

        const id = newFixtureId();
        if (drop.kind === 'mount') {
          let pos = drop.position;
          if (gridSnap) pos = snapVec3(pos, gridSize);
          const rotation = composeRotation(drop.rotation, pendingRotation);
          const inst = instantiateFixture(fixtureDef, id, pos, { rotation });
          dispatch({ type: 'fixture.add', fixture: inst });
          dispatch({
            type: 'fixture.mount',
            id,
            structureId: drop.structureId,
            socketId: drop.socketId,
          });
          debugLog('info', `placed ${fixtureDef.label} on structure`);
        } else {
          let pos = drop.position;
          if (gridSnap) pos = snapVec3(pos, gridSize);
          const inst = instantiateFixture(fixtureDef, id, pos, {
            onGround: true,
            rotation: pendingRotation,
          });
          dispatch({ type: 'fixture.add', fixture: inst });
          debugLog('info', `placed ${fixtureDef.label} on ground`);
        }
        setPlacement(null);
      }
    };

    const onContext = (ev: MouseEvent) => {
      ev.preventDefault();
      setPlacement(null);
      setStructurePlacement(null);
    };

    window.addEventListener('keydown', onKey);
    if (structureDef) dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('click', onClick);
    dom.addEventListener('contextmenu', onContext);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (structureDef) dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('click', onClick);
      dom.removeEventListener('contextmenu', onContext);
      clearStructurePlacement();
    };
  }, [
    pendingTypeId,
    pendingStructureTypeId,
    pendingFixtureTypeId,
    structures,
    gl,
    camera,
    gridSnap,
    gridSize,
    dispatch,
    newFixtureId,
    setPlacement,
    setStructurePlacement,
    rotatePending,
    debugLog,
  ]);

  return null;
}
