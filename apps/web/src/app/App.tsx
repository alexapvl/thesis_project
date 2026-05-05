import { FileUpload } from '@/features/audio-file-session/FileUpload';
import { PlaybackControls } from '@/features/playback-controls/PlaybackControls';
import { MicToggle } from '@/features/microphone-session/MicToggle';
import { StatusBar } from '@/features/inference-status/StatusBar';
import { FixtureCatalog } from '@/features/fixture-catalog/FixtureCatalog';
import { SceneEditorPanel } from '@/features/scene-editor/SceneEditorPanel';
import { useSceneShortcuts } from '@/features/scene-editor/useSceneShortcuts';
import { PersistenceControls } from '@/features/persistence/PersistenceControls';
import { useAutosave } from '@/features/persistence/useAutosave';
import { useHydrate } from '@/features/persistence/useHydrate';
import { DebugPanel } from '@/components/DebugPanel';
import { SceneCanvas } from '@/scene/editor/SceneCanvas';
import { useAudioBoot } from '@/audio/useAudioBoot';

export function App() {
  useHydrate();
  useAutosave();
  useSceneShortcuts();
  useAudioBoot();

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">sound-to-light</span>
        <FileUpload />
        <PlaybackControls />
        <MicToggle />
        <PersistenceControls />
        <StatusBar />
      </header>
      <main className="layout">
        <aside className="panel left">
          <FixtureCatalog />
        </aside>
        <section className="stage">
          <SceneCanvas />
        </section>
        <aside className="panel right">
          <SceneEditorPanel />
          <DebugPanel />
        </aside>
      </main>
      <footer className="bottombar">
        v0 scaffold · file flow first · transport not yet connected
      </footer>
    </div>
  );
}