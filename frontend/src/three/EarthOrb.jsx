import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Stylized "Earth" orb: glowing green/blue with an atmospheric outer shell.
 * Pure-procedural — no texture fetch needed.
 */
export default function EarthOrb({ size = 2, position = [0, 0, 0] }) {
  const inner = useRef(null);
  const atmos = useRef(null);

  useFrame((state, dt) => {
    if (inner.current) inner.current.rotation.y += dt * 0.18;
    if (atmos.current) atmos.current.rotation.y -= dt * 0.05;
  });

  return (
    <group position={position}>
      {/* land mass orb */}
      <mesh ref={inner}>
        <icosahedronGeometry args={[size, 5]} />
        <meshStandardMaterial
          color={new THREE.Color('#1e6b48')}
          emissive={new THREE.Color('#0c3a25')}
          emissiveIntensity={0.45}
          roughness={0.45}
          metalness={0.25}
          flatShading
        />
      </mesh>
      {/* ocean overlay */}
      <mesh>
        <sphereGeometry args={[size * 0.999, 64, 64]} />
        <meshStandardMaterial
          color={new THREE.Color('#0a4361')}
          transparent
          opacity={0.55}
          emissive={new THREE.Color('#062841')}
          emissiveIntensity={0.5}
          roughness={0.3}
        />
      </mesh>
      {/* atmospheric shell */}
      <mesh ref={atmos} scale={1.18}>
        <sphereGeometry args={[size, 64, 64]} />
        <meshBasicMaterial
          color={new THREE.Color('#5ce1ff')}
          transparent
          opacity={0.12}
          side={THREE.BackSide}
        />
      </mesh>
      {/* outer glow */}
      <mesh scale={1.3}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshBasicMaterial
          color={new THREE.Color('#7af598')}
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}
