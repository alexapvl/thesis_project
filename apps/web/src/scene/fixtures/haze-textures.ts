import * as THREE from 'three';

export function createPoolTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Soft axial + radial falloff so the beam reads as haze, not a solid cone. */
export function createHazeConeTexture(soft = false): THREE.CanvasTexture {
  const width = 64;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const peak = soft ? 0.55 : 0.85;
    const axial = ctx.createLinearGradient(0, 0, 0, height);
    axial.addColorStop(0, `rgba(255,255,255,${peak})`);
    axial.addColorStop(0.12, `rgba(255,255,255,${soft ? 0.28 : 0.45})`);
    axial.addColorStop(0.55, `rgba(255,255,255,${soft ? 0.08 : 0.12})`);
    axial.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = axial;
    ctx.fillRect(0, 0, width, height);

    const radial = ctx.createRadialGradient(width / 2, 0, 0, width / 2, height / 2, width / 2);
    radial.addColorStop(0, 'rgba(255,255,255,1)');
    radial.addColorStop(0.55, `rgba(255,255,255,${soft ? 0.35 : 0.55})`);
    radial.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
