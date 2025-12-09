import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { LuxuryTree } from './LuxuryTree';
import { useStore } from '../store';

const CameraController = () => {
    const cameraRef = useRef<THREE.PerspectiveCamera>(null);
    const orbitRef = useRef<any>(null);
    const rotationOffset = useStore(s => s.cameraRotationOffset);

    useFrame((state, delta) => {
        if (orbitRef.current) {
            // Smoothly rotate camera based on hand position
            // Base azimuth is auto-rotating slowly? Maybe not for "interactive" focus.
            // We'll add the offset to the current azimuth.
            const targetAzimuth = rotationOffset * Math.PI; // +/- 180 degrees
            
            // Damping towards the hand target angle
            orbitRef.current.setAzimuthalAngle(
                 THREE.MathUtils.lerp(orbitRef.current.getAzimuthalAngle(), targetAzimuth, delta * 2)
            );
            orbitRef.current.update();
        }
    });

    return (
        <OrbitControls 
            ref={orbitRef}
            enablePan={false} 
            enableZoom={true} 
            minPolarAngle={Math.PI / 3} 
            maxPolarAngle={Math.PI / 1.8}
            minDistance={12}
            maxDistance={30}
        />
    );
};

// --- Snow Particles Shader ---
const SnowShaderMaterial = {
  vertexShader: `
    uniform float uTime;
    attribute float aScale;
    attribute float aSpeed;
    attribute float aRandom;
    varying float vAlpha;
    
    void main() {
      vec3 pos = position;
      
      // Fall animation
      float fallSpeed = aSpeed * 2.0 + 1.0;
      float yPos = pos.y - uTime * fallSpeed;
      
      // Wrap Y: Range -15 to 25 (Height 40)
      float height = 40.0;
      pos.y = mod(yPos + 15.0, height) - 15.0;
      
      // Sway animation
      float sway = sin(uTime * 0.5 + aRandom * 10.0) * 0.5 + sin(uTime * 1.5 + aRandom * 5.0) * 0.2;
      pos.x += sway;
      pos.z += sway * 0.5;
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Distance attenuation
      gl_PointSize = aScale * (300.0 / -mvPosition.z);
      
      // Fade out near bottom/top boundary to avoid popping
      float boundaryFade = smoothstep(-15.0, -10.0, pos.y) * (1.0 - smoothstep(20.0, 25.0, pos.y));
      vAlpha = 0.8 * boundaryFade;
    }
  `,
  fragmentShader: `
    varying float vAlpha;
    
    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;
      
      // Soft glow
      float strength = 1.0 - (dist * 2.0);
      strength = pow(strength, 1.5);
      
      // Desaturated Cool White / Silver tint
      // R=0.95, G=0.95, B=0.98
      vec3 color = vec3(0.95, 0.95, 0.98);
      
      gl_FragColor = vec4(color, vAlpha * strength);
    }
  `
};

const SnowParticles = () => {
    const count = 3000;
    const shaderRef = useRef<THREE.ShaderMaterial>(null);
    
    const { positions, scales, speeds, randoms } = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const sc = new Float32Array(count);
        const sp = new Float32Array(count);
        const rnd = new Float32Array(count);
        
        for (let i = 0; i < count; i++) {
            // Box area: x[-20, 20], y[-15, 25], z[-20, 20]
            pos[i*3] = (Math.random() - 0.5) * 40;
            pos[i*3+1] = (Math.random() - 0.5) * 40 + 5; 
            pos[i*3+2] = (Math.random() - 0.5) * 40;
            
            sc[i] = Math.random() * 0.2 + 0.1; // size
            sp[i] = Math.random(); // speed variant
            rnd[i] = Math.random();
        }
        return { positions: pos, scales: sc, speeds: sp, randoms: rnd };
    }, []);

    useFrame((state) => {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return (
        <points>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
                <bufferAttribute attach="attributes-aScale" count={count} array={scales} itemSize={1} />
                <bufferAttribute attach="attributes-aSpeed" count={count} array={speeds} itemSize={1} />
                <bufferAttribute attach="attributes-aRandom" count={count} array={randoms} itemSize={1} />
            </bufferGeometry>
            <shaderMaterial
                ref={shaderRef}
                vertexShader={SnowShaderMaterial.vertexShader}
                fragmentShader={SnowShaderMaterial.fragmentShader}
                uniforms={{ uTime: { value: 0 } }}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
};

// Fairy Dust Effect
const FairyDust = () => {
    const count = 200;
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const particles = useMemo(() => {
        const temp = [];
        for(let i=0; i<count; i++) {
            temp.push({
                t: Math.random() * 100,
                factor: 20 + Math.random() * 100,
                speed: 0.01 + Math.random() * 0.02,
                xFactor: -5 + Math.random() * 10,
                yFactor: -5 + Math.random() * 10,
                zFactor: -5 + Math.random() * 10,
                mx: 0, my: 0, mz: 0
            });
        }
        return temp;
    }, []);

    useFrame((state) => {
        if(!mesh.current) return;
        particles.forEach((particle, i) => {
            let t = particle.t = particle.t + particle.speed;
            // Rising spiral movement
            const a = Math.cos(t) + Math.sin(t * 1) / 10;
            const b = Math.sin(t) + Math.cos(t * 2) / 10;
            
            const x = (particle.xFactor + Math.cos((t / 10) * particle.factor) + (Math.sin(t * 1) * particle.factor) / 10);
            const y = (particle.yFactor + Math.sin((t / 10) * particle.factor) + (Math.cos(t * 2) * particle.factor) / 10) + t; // Add t to y for rising
            const z = (particle.zFactor + Math.cos((t / 10) * particle.factor) + (Math.sin(t * 3) * particle.factor) / 10);
            
            // Loop height
            const heightMod = (y % 20) - 10;

            dummy.position.set(x * 0.5, heightMod, z * 0.5);
            dummy.scale.setScalar(Math.cos(t) * 0.04 + 0.05);
            dummy.rotation.set(t, t, t);
            dummy.updateMatrix();
            mesh.current!.setMatrixAt(i, dummy.matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
            <dodecahedronGeometry args={[0.2, 0]} />
            <meshBasicMaterial color="#f5f0f2" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
        </instancedMesh>
    );
};

export const Experience: React.FC = () => {
  return (
    <Canvas 
      shadows 
      dpr={[1, 2]} 
      gl={{ antialias: false, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }}
      camera={{ position: [0, 4, 20], fov: 45 }}
    >
      <color attach="background" args={['#050505']} />
      <Environment preset="lobby" />
      
      {/* Lighting - Warm Silver / Pale Rose Ambient (Desaturated) */}
      <ambientLight intensity={0.5} color="#f0e6e8" />
      <spotLight position={[10, 20, 10]} angle={0.15} penumbra={1} intensity={5} castShadow />
      
      <group position={[0, -2, 0]}>
        <LuxuryTree />
        <SnowParticles />
        <FairyDust />
        <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={10} color="#000000" />
      </group>

      <CameraController />

      <EffectComposer>
        <Bloom 
            luminanceThreshold={0.8} 
            mipmapBlur 
            intensity={1.2} 
            radius={0.6}
            levels={8}
        />
      </EffectComposer>
    </Canvas>
  );
};