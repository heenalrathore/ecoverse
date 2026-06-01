import { useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, BackSide } from 'three';
import * as THREE from 'three';

/**
 * Realistic textured Earth, with rotating cloud shell + atmospheric rim glow.
 *
 * Textures are loaded from threejs.org's public demo CDN — they ship with
 * every three.js release and are stable URLs. If they ever fail to load,
 * Suspense in the parent should render the procedural EarthOrb fallback.
 */
const DAY_MAP   = 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';
const SPEC_MAP  = 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg';
const CLOUD_MAP = 'https://threejs.org/examples/textures/planets/earth_clouds_1024.png';

export default function RealisticEarth({ size = 2, position = [0, 0, 0] }) {
  const [day, spec, clouds] = useLoader(TextureLoader, [DAY_MAP, SPEC_MAP, CLOUD_MAP]);

  const earthRef  = useRef(null);
  const cloudsRef = useRef(null);

  useFrame((_, dt) => {
    if (earthRef.current)  earthRef.current.rotation.y  += dt * 0.05;
    if (cloudsRef.current) cloudsRef.current.rotation.y += dt * 0.07;
  });

  return (
    <group position={position}>
      {/* Main globe */}
      <mesh ref={earthRef} castShadow receiveShadow>
        <sphereGeometry args={[size, 96, 96]} />
        <meshPhongMaterial
          map={day}
          specularMap={spec}
          specular={new THREE.Color('#3a6b8a')}
          shininess={18}
        />
      </mesh>

      {/* Cloud shell — slightly larger, semi-transparent, rotating independently */}
      <mesh ref={cloudsRef} scale={1.008}>
        <sphereGeometry args={[size, 96, 96]} />
        <meshPhongMaterial
          map={clouds}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>

      {/* Inner atmosphere — backside glow ring */}
      <mesh scale={1.06}>
        <sphereGeometry args={[size, 64, 64]} />
        <meshBasicMaterial
          color={new THREE.Color('#5cc8ff')}
          transparent
          opacity={0.10}
          side={BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Outer halo — larger, softer */}
      <mesh scale={1.22}>
        <sphereGeometry args={[size, 48, 48]} />
        <meshBasicMaterial
          color={new THREE.Color('#a4d8ff')}
          transparent
          opacity={0.06}
          side={BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
