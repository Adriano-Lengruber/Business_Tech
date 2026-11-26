'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function StlPreviewCanvas({
  stlBuffer,
  colorHex = '#3B82F6',
}: {
  stlBuffer: ArrayBuffer | null;
  colorHex?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = 260;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0B0F17');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(60, 50, 70);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const grid = new THREE.GridHelper(120, 12, 0x334155, 0x1e293b);
    scene.add(grid);

    const light1 = new THREE.DirectionalLight(0xffffff, 1.3);
    light1.position.set(50, 80, 60);
    scene.add(light1);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    let geometry: THREE.BufferGeometry;
    if (stlBuffer) {
      const loader = new STLLoader();
      geometry = loader.parse(stlBuffer);
      geometry.computeBoundingBox();
      geometry.center();
      const box = geometry.boundingBox;
      if (box) {
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 36 / maxDim;
        geometry.scale(scale, scale, scale);
      }
    } else {
      geometry = new THREE.TorusKnotGeometry(12, 3.6, 120, 16);
    }

    const material = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.35,
      metalness: 0.15,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 14;
    scene.add(mesh);

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!stlBuffer) {
        mesh.rotation.y += 0.008;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [stlBuffer, colorHex]);

  return (
    <div
      ref={containerRef}
      className="h-[260px] w-full overflow-hidden rounded-lg border border-border"
    />
  );
}
