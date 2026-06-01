import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Drifting particle cloud — used for the cinematic hero backdrop. */
export default function ParticleField({ count = 1500, color = '#7af598', radius = 14 }) {
  const points = useRef(null);

  const { positions, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = Math.cbrt(Math.random()) * radius;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = Math.random() * 0.12 + 0.02;
    }
    return { positions, sizes };
  }, [count, radius]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (points.current) {
      points.current.rotation.y = t * 0.02;
      points.current.rotation.x = Math.sin(t * 0.05) * 0.05;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        color={new THREE.Color(color)}
        size={0.08}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
