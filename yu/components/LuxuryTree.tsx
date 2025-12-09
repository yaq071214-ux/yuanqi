import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { COLORS, GEM_COLORS, TREE_HEIGHT, TREE_RADIUS, CHAOS_RADIUS } from '../constants';

// --- Helper Math ---
const randomSpherePoint = (radius: number) => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius; 
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );
};

// --- Shaders ---
const FoliageShaderMaterial = {
  vertexShader: `
    attribute vec3 chaosPos;
    attribute vec3 targetPos;
    attribute float size;
    uniform float uChaos; 
    uniform float uTime;
    varying float vAlpha;
    varying vec3 vColor;

    float easeInOutCubic(float x) {
      return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
    }

    void main() {
      float t = easeInOutCubic(uChaos);
      vec3 pos = mix(targetPos, chaosPos, t);
      
      // Floating noise in chaos
      if (t > 0.01) {
        pos.x += sin(uTime * 1.5 + pos.y) * 0.5 * t;
        pos.y += cos(uTime * 1.0 + pos.x) * 0.5 * t;
      } else {
        // Subtle wind breath in formed state
        float wind = sin(uTime * 0.5 + pos.y * 0.5) * 0.05;
        pos.x += wind;
        pos.z += wind * 0.5;
      }

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Smaller, denser particles
      gl_PointSize = size * (250.0 / -mvPosition.z);

      // Elegant Silver/Rose Sparkle
      float sparkle = sin(uTime * 3.0 + pos.x * 20.0 + pos.y * 10.0) * 0.5 + 0.5;
      
      // Mix between Desaturated Pale Pink and Silver/White
      // R=0.95, G=0.9, B=0.92 (Pale Rose) -> R=0.98, G=0.98, B=1.0 (Silver White)
      vColor = mix(vec3(0.95, 0.90, 0.92), vec3(0.98, 0.98, 1.0), sparkle);
      
      vAlpha = 0.6 + 0.4 * sparkle;
    }
  `,
  fragmentShader: `
    varying float vAlpha;
    varying vec3 vColor;
    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;
      
      // Sharper glow for crystalline look
      float strength = 1.0 - (dist * 2.0);
      strength = pow(strength, 2.0);
      
      gl_FragColor = vec4(vColor, vAlpha * strength);
    }
  `
};

// --- Sub-components (Defined before Main Component to avoid Hoisting/Reference Errors) ---

// --- Ornaments Sub-component ---
const Ornaments = ({ type, count, color, colors, chaosFactorRef }: { type: string, count: number, color?: any, colors?: string[], chaosFactorRef: React.MutableRefObject<number> }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Star Geometry Memoization
  const starGeometry = useMemo(() => {
    if (type !== 'star') return null;
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 0.5;
    const innerRadius = 0.22; // Sharper star
    const angleStep = Math.PI / points;
    
    for(let i = 0; i < 2 * points; i++) {
        const r = (i % 2 === 0) ? outerRadius : innerRadius;
        const a = i * angleStep;
        // Rotate -PI/2 to point upwards initially
        const x = Math.cos(a - Math.PI/2) * r;
        const y = Math.sin(a - Math.PI/2) * r;
        if(i===0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.02, bevelSegments: 1 });
  }, [type]);

  const { targetData, chaosData, colorArray } = useMemo(() => {
    const tData: THREE.Vector3[] = [];
    const cData: THREE.Vector3[] = [];
    const cArr: THREE.Color[] = [];
    
    for (let i = 0; i < count; i++) {
        // Surface distribution
        const hNorm = Math.random() * 0.95; 
        const y = hNorm * TREE_HEIGHT - TREE_HEIGHT / 2;
        
        // Push to surface
        const surfaceR = (1 - hNorm) * TREE_RADIUS;
        
        // Gems/Stars mostly outer, lights mixed
        const depth = type === 'light' ? (0.6 + Math.random() * 0.4) : (0.85 + Math.random() * 0.15);
        const r = surfaceR * depth;
        
        const theta = Math.random() * Math.PI * 2;
        
        tData.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
        cData.push(randomSpherePoint(CHAOS_RADIUS * 1.5));
        
        if (colors) {
            cArr.push(new THREE.Color(colors[Math.floor(Math.random() * colors.length)]));
        }
    }
    return { targetData: tData, chaosData: cData, colorArray: cArr };
  }, [count, colors, type]);

  useLayoutEffect(() => {
      if (meshRef.current && colors && colorArray.length > 0) {
          colorArray.forEach((c, i) => meshRef.current!.setColorAt(i, c));
          meshRef.current.instanceColor!.needsUpdate = true;
      }
  }, [colorArray, colors]);

  const tempObj = new THREE.Object3D();

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = chaosFactorRef.current;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        tempObj.position.lerpVectors(targetData[i], chaosData[i], ease);
        
        if (t > 0.1) {
             tempObj.position.y += Math.sin(time + i) * 0.05 * t;
             tempObj.rotation.x = time * 0.5 + i;
             tempObj.rotation.y = time * 0.3 + i;
        } else {
             // Subtle rotation
             tempObj.rotation.y = time * 0.15 + i;
             if (type === 'star') {
                tempObj.rotation.z = Math.sin(time + i) * 0.1; // Rocking stars
             }
        }
        
        // Scaling
        let scaleBase = 0.12;
        if (type === 'light') scaleBase = 0.04;
        if (type === 'star') scaleBase = 0.18; // Slightly larger stars

        tempObj.scale.setScalar(scaleBase * (1.0 - t * 0.3));
        tempObj.updateMatrix();
        meshRef.current.setMatrixAt(i, tempObj.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      {type === 'gem' && <icosahedronGeometry args={[1, 0]} />} 
      {type === 'light' && <sphereGeometry args={[1, 8, 8]} />}
      {type === 'star' && starGeometry && <primitive object={starGeometry} />}
      
      <meshStandardMaterial 
        color={color || '#ffffff'} 
        emissive={type === 'light' ? color : (type === 'star' ? '#111111' : '#000000')}
        emissiveIntensity={type === 'light' ? 2 : 0.2}
        roughness={type === 'star' ? 0.2 : 0.05}
        metalness={1.0}
        envMapIntensity={3}
      />
    </instancedMesh>
  );
};

// --- Double Logarithmic Spiral Pearl Strands ---
const PearlStrands = ({ chaosFactorRef }: { chaosFactorRef: React.MutableRefObject<number> }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const pearlsPerSpiral = 300; 
    const spirals = 2;
    const total = spirals * pearlsPerSpiral;

    const { targets, chaos } = useMemo(() => {
        const t = [];
        const c = [];
        
        const rotations = 5; 
        const heightStart = TREE_HEIGHT / 2 - 0.5;
        const heightEnd = -TREE_HEIGHT / 2 + 1;
        const heightSpan = heightStart - heightEnd;

        for(let s=0; s<spirals; s++) {
            const phaseOffset = s * Math.PI; 
            
            for(let p=0; p<pearlsPerSpiral; p++) {
                const alpha = p / (pearlsPerSpiral - 1);
                const y = heightStart - alpha * heightSpan;
                const hNorm = (y + TREE_HEIGHT/2) / TREE_HEIGHT;
                
                // Adjusted for new radius
                const r = (1 - hNorm) * (TREE_RADIUS + 0.3); 
                
                const theta = alpha * Math.PI * 2 * rotations + phaseOffset;

                t.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
                c.push(randomSpherePoint(CHAOS_RADIUS));
            }
        }
        return { targets: t, chaos: c };
    }, []);

    const dummy = new THREE.Object3D();
    
    useFrame((state) => {
        if(!meshRef.current) return;
        const t = chaosFactorRef.current;
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        for(let i=0; i<total; i++) {
             dummy.position.lerpVectors(targets[i], chaos[i], ease);
             dummy.scale.setScalar(0.08 * (1.0 - t * 0.2));
             dummy.updateMatrix();
             meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, total]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial 
                color={COLORS.pearl} 
                roughness={0.1} 
                metalness={0.7} 
                emissive={COLORS.pearl}
                emissiveIntensity={0.2}
            />
        </instancedMesh>
    );
};

// --- Hexagram Star Topper ---
const StarTopper = ({ chaosFactorRef }: { chaosFactorRef: React.MutableRefObject<number> }) => {
    const groupRef = useRef<THREE.Group>(null);
    const starRef = useRef<THREE.Group>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const haloRef = useRef<THREE.Mesh>(null);
    
    const targetPos = new THREE.Vector3(0, TREE_HEIGHT / 2 + 0.5, 0);
    const chaosPos = useMemo(() => randomSpherePoint(CHAOS_RADIUS), []);

    useFrame((state) => {
        if(!groupRef.current) return;
        const t = chaosFactorRef.current;
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        
        groupRef.current.position.lerpVectors(targetPos, chaosPos, ease);
        
        // Scale down to 0.3x
        const baseScale = 0.3 * (1 - t * 0.5); // Shrink slightly in chaos too
        groupRef.current.scale.setScalar(baseScale);

        if(starRef.current) {
            starRef.current.rotation.y += 0.01;
            starRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
        }

        const pulse = (Math.sin(state.clock.elapsedTime * 2.0) + 1) * 0.5;
        
        if (lightRef.current) lightRef.current.intensity = 2 + pulse * 2;
        
        if (haloRef.current) {
            haloRef.current.scale.setScalar(1 + pulse * 0.1);
            (haloRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + pulse * 0.3;
        }
    });

    return (
        <group ref={groupRef}>
            <group ref={starRef}>
                <mesh>
                    <tetrahedronGeometry args={[0.8, 0]} />
                    <meshStandardMaterial color={COLORS.star} emissive={COLORS.star} emissiveIntensity={3} toneMapped={false} />
                </mesh>
                <mesh rotation={[Math.PI, 0, Math.PI/6]}>
                    <tetrahedronGeometry args={[0.8, 0]} />
                    <meshStandardMaterial color={COLORS.star} emissive={COLORS.star} emissiveIntensity={3} toneMapped={false} />
                </mesh>
            </group>
            
            <mesh ref={haloRef} rotation={[Math.PI/2, 0, 0]}>
                 <torusGeometry args={[1.2, 0.05, 16, 100]} />
                 <meshBasicMaterial color={COLORS.silver} transparent opacity={0.5} toneMapped={false} />
            </mesh>

            <pointLight ref={lightRef} distance={15} color={COLORS.star} />
        </group>
    );
};

// --- Main Tree Component ---
export const LuxuryTree: React.FC = () => {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const chaosFactor = useStore((s) => s.chaosFactor);
  const currentChaos = useRef(0);

  // --- Geometry Generation: Dense Uniform Cone ---
  const { positions, chaosPositions, sizes } = useMemo(() => {
    // Adjusted count for Radius 4.5
    const count = 40000; 
    
    const pos = new Float32Array(count * 3);
    const cPos = new Float32Array(count * 3);
    const sz = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        // Uniform Volume Cone Sampling
        const h = Math.random(); 
        const y = h * TREE_HEIGHT - TREE_HEIGHT / 2;
        
        // Radius at height h
        const maxRAtH = (1 - h) * TREE_RADIUS;
        
        // Uniform disk sampling
        const r = maxRAtH * Math.sqrt(Math.random());
        const theta = Math.random() * Math.PI * 2;

        pos[i * 3] = r * Math.cos(theta);
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = r * Math.sin(theta);

        // Chaos
        const c = randomSpherePoint(CHAOS_RADIUS);
        cPos[i * 3] = c.x;
        cPos[i * 3 + 1] = c.y;
        cPos[i * 3 + 2] = c.z;

        // Varied sizes
        sz[i] = Math.random() * 0.12 + 0.05;
    }
    return { positions: pos, chaosPositions: cPos, sizes: sz };
  }, []);

  useFrame((state, delta) => {
    currentChaos.current = THREE.MathUtils.lerp(currentChaos.current, chaosFactor, delta * 2.0);
    if (shaderRef.current) {
      shaderRef.current.uniforms.uChaos.value = currentChaos.current;
      shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group>
      {/* Dense Foliage */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-targetPos" count={positions.length / 3} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-chaosPos" count={chaosPositions.length / 3} array={chaosPositions} itemSize={3} />
          <bufferAttribute attach="attributes-size" count={sizes.length} array={sizes} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          ref={shaderRef}
          vertexShader={FoliageShaderMaterial.vertexShader}
          fragmentShader={FoliageShaderMaterial.fragmentShader}
          uniforms={{ uChaos: { value: 0 }, uTime: { value: 0 } }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      
      {/* Total Ornaments = 1600 */}
      {/* 500 Gems - Desaturated Elegance */}
      <Ornaments type="gem" count={500} colors={GEM_COLORS} chaosFactorRef={currentChaos} />
      
      {/* 600 Lights - Near White / Soft Champagne */}
      <Ornaments type="light" count={600} color="#fffafc" chaosFactorRef={currentChaos} />
      
      {/* 500 Stars - Pale Silvery Pink */}
      <Ornaments type="star" count={500} color="#e6dadd" chaosFactorRef={currentChaos} />

      {/* Double Logarithmic Spiral Pearls - White/Pearl Tone */}
      <PearlStrands chaosFactorRef={currentChaos} />
      
      {/* Hexagram Star Topper - Scaled 0.3x */}
      <StarTopper chaosFactorRef={currentChaos} />
    </group>
  );
};