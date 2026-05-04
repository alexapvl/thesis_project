import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">sound-to-light</span>
        <span className="status">scaffold · v0</span>
      </header>
      <main className="layout">
        <aside className="panel left">Fixture catalog</aside>
        <section className="stage">
          <Canvas camera={{ position: [6, 6, 8], fov: 50 }}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 10, 5]} intensity={0.8} />
            <Grid args={[20, 20]} cellColor="#334155" sectionColor="#475569" />
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#7c3aed" />
            </mesh>
            <OrbitControls />
          </Canvas>
        </section>
        <aside className="panel right">Scene editor</aside>
      </main>
      <footer className="bottombar">Transport: idle · Inference: idle</footer>
    </div>
  );
}
