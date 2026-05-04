import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { FileUpload } from '@/features/audio-file-session/FileUpload';
import { PlaybackControls } from '@/features/playback-controls/PlaybackControls';
import { StatusBar } from '@/features/inference-status/StatusBar';
import { FixtureCatalog } from '@/features/fixture-catalog/FixtureCatalog';
import { SceneEditorPanel } from '@/features/scene-editor/SceneEditorPanel';
import { DebugPanel } from '@/components/DebugPanel';

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">sound-to-light</span>
        <FileUpload />
        <PlaybackControls />
        <StatusBar />
      </header>
      <main className="layout">
        <aside className="panel left">
          <FixtureCatalog />
        </aside>
        <section className="stage">
          <Canvas camera={{ position: [6, 6, 8], fov: 50 }}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 10, 5]} intensity={0.8} />
            <Grid args={[20, 20]} cellColor="#334155" sectionColor="#475569" />
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#7c3aed" />
            </mesh>
            <OrbitControls />
          </Canvas>
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