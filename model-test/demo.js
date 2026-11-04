import * as THREE from 'three';
export function demo() { const m = new THREE.Mesh(new THREE.BoxGeometry(12.2, 2.6, 2.44), new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.6, metalness: 0.3 })); m.position.y = 1.3; m.castShadow = true; return m; }
