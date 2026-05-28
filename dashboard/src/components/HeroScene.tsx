"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function Core() {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = clock.getElapsedTime() * 0.12;
    meshRef.current.rotation.y = clock.getElapsedTime() * 0.18;
    if (wireRef.current) {
      wireRef.current.rotation.x = clock.getElapsedTime() * 0.15;
      wireRef.current.rotation.y = clock.getElapsedTime() * 0.22;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.4}>
      <mesh ref={meshRef} scale={1.6}>
        <icosahedronGeometry args={[1, 2]} />
        <MeshDistortMaterial
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.25}
          roughness={0.2}
          metalness={0.95}
          transparent
          opacity={0.35}
          wireframe={false}
          distort={0.2}
          speed={1.5}
        />
      </mesh>
      <mesh ref={wireRef} scale={1.7}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.15} />
      </mesh>
      <mesh scale={1.8}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.04} />
      </mesh>
    </Float>
  );
}

function InnerCore() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = clock.getElapsedTime() * 0.25;
    meshRef.current.rotation.y = clock.getElapsedTime() * 0.35;
  });

  return (
    <mesh ref={meshRef} scale={0.45}>
      <octahedronGeometry args={[1, 0]} />
      <meshPhysicalMaterial
        color="#ffffff"
        emissive="#60a5fa"
        emissiveIntensity={0.4}
        roughness={0.05}
        metalness={0.1}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function GalaxyParticles({ count = 800 }) {
  const meshRef = useRef<THREE.Points>(null);

  const [positions, colors, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const radius = 1.5 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
      pos[i * 3 + 2] = radius * Math.cos(phi);

      const rnd = Math.random();
      let r, g, b;
      const isBright = Math.random() > 0.85;
      const brightMul = isBright ? 1.0 : 0.6 + Math.random() * 0.4;

      if (rnd < 0.20) {
        r = 1.0 * brightMul; g = 0.25 * brightMul; b = 0.15 * brightMul;
      } else if (rnd < 0.40) {
        r = 0.2 * brightMul; g = 0.5 * brightMul; b = 1.0 * brightMul;
      } else if (rnd < 0.55) {
        r = 0.9 * brightMul; g = 0.6 * brightMul; b = 0.1 * brightMul;
      } else if (rnd < 0.70) {
        r = 1.0 * brightMul; g = 1.0 * brightMul; b = 1.0 * brightMul;
      } else if (rnd < 0.82) {
        r = 0.6 * brightMul; g = 0.2 * brightMul; b = 1.0 * brightMul;
      } else {
        r = 0.1 * brightMul; g = 0.9 * brightMul; b = 0.6 * brightMul;
      }

      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;

      siz[i] = isBright ? 0.06 + Math.random() * 0.08 : 0.015 + Math.random() * 0.035;
    }
    return [pos, col, siz];
  }, [count]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = clock.getElapsedTime() * 0.012;
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.004) * 0.04;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute args={[positions, 3]} attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute args={[colors, 3]} attach="attributes-color" count={count} array={colors} itemSize={3} />
        <bufferAttribute args={[sizes, 1]} attach="attributes-size" count={count} array={sizes} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial size={0.045} vertexColors transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function OrbitRing({ radius = 3, speed = 0.4, offset = 0 }: { radius?: number; speed?: number; offset?: number }) {
  const dotRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!dotRef.current) return;
    const t = clock.getElapsedTime() * speed + offset;
    dotRef.current.position.x = Math.cos(t) * radius;
    dotRef.current.position.z = Math.sin(t) * radius;
    if (glowRef.current) {
      glowRef.current.position.x = Math.cos(t) * radius;
      glowRef.current.position.z = Math.sin(t) * radius;
    }
  });

  return (
    <group rotation={[Math.PI * 0.3 + offset * 0.1, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.008, radius + 0.008, 64]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} />
      </mesh>
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>
    </group>
  );
}

export default function HeroScene() {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#3b82f6" />
        <pointLight position={[-10, -10, -10]} intensity={0.6} color="#60a5fa" />
        <pointLight position={[0, 15, 0]} intensity={0.3} color="#ffffff" />
        <Core />
        <InnerCore />
        <GalaxyParticles count={600} />
        <OrbitRing radius={3.0} speed={0.4} offset={0} />
        <OrbitRing radius={4.0} speed={-0.3} offset={1.2} />
        <OrbitRing radius={5.0} speed={0.25} offset={2.5} />
        <OrbitRing radius={6.0} speed={-0.18} offset={0.8} />
      </Canvas>
    </div>
  );
}
