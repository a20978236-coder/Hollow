import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createHologramMaterial } from './hologramMaterial';

const BLUE = new THREE.Color('#29b6ff');
const CHARACTER_HEIGHT = 1.8;

export type Quality = 'high' | 'low';
export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

// Each assistant state has its own color and energy so you can tell at a glance what HOLLOW is doing.
const STATE_LOOK: Record<AssistantState, { color: THREE.Color; spin: number; scan: number; energy: number }> = {
  idle: { color: new THREE.Color('#29b6ff'), spin: 1, scan: 1, energy: 0 },
  listening: { color: new THREE.Color('#4ff0ff'), spin: 1.6, scan: 0.6, energy: 0.25 },
  thinking: { color: new THREE.Color('#5a7dff'), spin: 5, scan: 3.5, energy: 0.45 },
  speaking: { color: new THREE.Color('#3cc4ff'), spin: 2, scan: 1.5, energy: 0.3 },
};

export class HologramScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private clock = new THREE.Clock();
  private mixer?: THREE.AnimationMixer;
  private character = new THREE.Group();
  private holoMaterials: THREE.ShaderMaterial[] = [];
  private rings: THREE.Mesh[] = [];
  private particles!: THREE.Points;
  private beam!: THREE.Mesh;
  private reveal = 0;
  private revealTarget = 0;
  private activity = 0; // 0..1, extra glow (boot sequence)
  private state: AssistantState = 'idle';
  private level = 0; // live audio level 0..1 (mic while listening, voice while speaking)
  private smoothLevel = 0;
  private energy = 0;
  private spin = 1;
  private scanTime = 0;
  private scanSpeed = 1;
  private color = BLUE.clone();
  private core!: THREE.Group;
  private coreGlow!: THREE.Sprite;
  private coreSphere!: THREE.Mesh;
  private ringMats: THREE.MeshBasicMaterial[] = [];
  private quality: Quality = 'high';
  private lastFrame = 0;
  fps = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    container.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2(0x000308, 0.12);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 0.95, 5.0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.74, 0);
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.enableDamping = true;
    this.controls.minPolarAngle = Math.PI * 0.35;
    this.controls.maxPolarAngle = Math.PI * 0.55;
    this.controls.rotateSpeed = 0.6;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.4, 0.12);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.buildProjector();
    this.buildCore();
    this.scene.add(this.character);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.tick());
  }

  /** Loads the character model. Resolves when it is ready to be shown. */
  async loadCharacter(url: string): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;

    // Normalize any model to a consistent human height, standing on the projector.
    // `precise` measures the skinned (posed) mesh, not its raw bind-pose geometry.
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const size = box.getSize(new THREE.Vector3());
    const scale = CHARACTER_HEIGHT / size.y;
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);
    box.setFromObject(model, true);
    model.position.y -= box.min.y;
    model.position.x -= (box.min.x + box.max.x) / 2;
    model.position.z -= (box.min.z + box.max.z) / 2;

    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = createHologramMaterial(BLUE.clone());
      mat.uniforms.uHeight.value = CHARACTER_HEIGHT;
      this.holoMaterials.push(mat);
      mesh.material = mat;
      mesh.frustumCulled = false;
    });
    this.character.add(model);

    // Mount the energy core in the chest so it moves with the body.
    let chest: THREE.Object3D | undefined;
    model.traverse((o) => { if (!chest && /spine2|spine1|chest/i.test(o.name)) chest = o; });
    if (chest) {
      const worldScale = new THREE.Vector3();
      chest.getWorldScale(worldScale);
      this.core.scale.setScalar(1 / worldScale.x);
      this.core.position.set(0, 0.08 / worldScale.y, 0.13 / worldScale.z);
      chest.add(this.core);
    } else {
      this.core.position.set(0, 1.35, 0.15);
    }

    if (gltf.animations.length) {
      this.mixer = new THREE.AnimationMixer(model);
      const idle = gltf.animations.find((a) => /idle/i.test(a.name)) ?? gltf.animations[0];
      this.mixer.clipAction(idle).play();
    }
  }

  /** Plays the bottom-to-top "materialize" effect. */
  materialize() { this.revealTarget = 1; }
  dematerialize() { this.revealTarget = 0; }

  setActivity(level: number) { this.activity = THREE.MathUtils.clamp(level, 0, 1); }

  /** What HOLLOW is doing right now: drives color, motion and the energy core. */
  setState(state: AssistantState) { this.state = state; if (state === 'idle') this.level = 0; }

  /** Live audio level (0..1) from the microphone or HOLLOW's voice. */
  setLevel(level: number) { this.level = THREE.MathUtils.clamp(level, 0, 1); }

  private buildCore() {
    this.core = new THREE.Group();
    this.coreSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(120,220,255,0.8)');
    grad.addColorStop(1, 'rgba(41,182,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    this.coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), color: BLUE, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.coreGlow.scale.setScalar(0.32);
    this.core.add(this.coreSphere, this.coreGlow);
    this.core.position.set(0, 1.35, 0.15);
    this.scene.add(this.core);
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio, 2) : 1);
    this.resize();
  }

  private buildProjector() {
    // Floor grid disc
    const grid = new THREE.PolarGridHelper(1.6, 16, 8, 64, BLUE, BLUE);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.18;
    this.scene.add(grid);

    // Glowing projector rings
    const ringDefs = [
      { r: 0.55, w: 0.02, o: 0.9 },
      { r: 0.75, w: 0.008, o: 0.6 },
      { r: 1.05, w: 0.015, o: 0.45, dashed: true },
      { r: 1.4, w: 0.004, o: 0.35 },
    ];
    for (const d of ringDefs) {
      const geo = d.dashed
        ? new THREE.RingGeometry(d.r, d.r + d.w * 4, 64, 1, 0, Math.PI * 1.6)
        : new THREE.RingGeometry(d.r, d.r + d.w, 96);
      const mat = new THREE.MeshBasicMaterial({
        color: BLUE.clone(), transparent: true, opacity: d.o,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
      });
      this.ringMats.push(mat);
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.005;
      this.rings.push(ring);
      this.scene.add(ring);
    }

    // Volumetric light beam from the projector
    const beamGeo = new THREE.CylinderGeometry(0.45, 0.62, 2.3, 48, 1, true);
    beamGeo.translate(0, 1.15, 0);
    this.beam = new THREE.Mesh(
      beamGeo,
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: BLUE.clone() }, uStrength: { value: 0.0 } },
        vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
          void main(){ vY = position.y / 2.3; vec4 mv = modelViewMatrix * vec4(position,1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vY; varying vec3 vN; varying vec3 vV;
          void main(){ float f = abs(dot(vN, vV)); float a = pow(1.0 - vY, 2.5) * f * 0.22 * uStrength;
          gl_FragColor = vec4(uColor, a); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    this.scene.add(this.beam);

    // Rising data particles
    const count = 420;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.15 + Math.random() * 1.2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 2.6;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: BLUE, size: 0.008, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    this.scene.add(this.particles);
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // Keep the full body in frame on tall phone screens.
    this.camera.fov = w / h < 0.7 ? 36 : 28;
    this.camera.updateProjectionMatrix();
    const scale = this.quality === 'high' ? 0.5 : 0.35;
    this.bloom.resolution.set(w * scale, h * scale);
  }

  private tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;

    const now = performance.now();
    if (this.lastFrame) this.fps = this.fps * 0.95 + (1000 / (now - this.lastFrame)) * 0.05;
    this.lastFrame = now;

    // Linear ~2.5 s materialize / dematerialize.
    const step = dt / 2.5;
    this.reveal = this.revealTarget > this.reveal ? Math.min(this.revealTarget, this.reveal + step) : Math.max(this.revealTarget, this.reveal - step);
    // Ease toward the current state's look.
    const look = STATE_LOOK[this.state];
    const k = Math.min(1, dt * 4);
    this.color.lerp(look.color, k);
    this.spin += (look.spin - this.spin) * k;
    this.scanSpeed += (look.scan - this.scanSpeed) * k;
    this.energy += (look.energy - this.energy) * k;
    this.smoothLevel += (this.level - this.smoothLevel) * Math.min(1, dt * (this.level > this.smoothLevel ? 25 : 8));
    this.scanTime += dt * this.scanSpeed;

    const thinkingPulse = this.state === 'thinking' ? (Math.sin(t * 9) * 0.5 + 0.5) * 0.35 : 0;
    const voice = this.smoothLevel * (this.state === 'speaking' ? 0.35 : 0.2);
    const pulse = 1 + this.activity * 0.6 + this.energy * 0.2 + voice + thinkingPulse * 0.6 + Math.sin(t * 2) * 0.04;

    for (const m of this.holoMaterials) {
      m.uniforms.uTime.value = this.scanTime;
      m.uniforms.uReveal.value = this.reveal;
      m.uniforms.uIntensity.value = pulse;
      (m.uniforms.uColor.value as THREE.Color).copy(this.color);
    }
    for (const m of this.ringMats) m.color.copy(this.color);
    (this.particles.material as THREE.PointsMaterial).color.copy(this.color);

    // Energy core: breathes when idle, flickers with thought, throbs with the voice.
    const coreScale = 1 + Math.sin(t * 2.2) * 0.08 + thinkingPulse * 1.2 + this.smoothLevel * 1.6;
    this.coreGlow.scale.setScalar(0.32 * coreScale);
    this.coreSphere.scale.setScalar(0.8 + this.smoothLevel * 0.8 + thinkingPulse);
    (this.coreGlow.material as THREE.SpriteMaterial).color.copy(this.color);
    (this.coreGlow.material as THREE.SpriteMaterial).opacity = this.reveal * (0.75 + this.smoothLevel * 0.25);
    (this.coreSphere.material as THREE.MeshBasicMaterial).opacity = this.reveal;
    this.mixer?.update(dt);
    // Subtle "alive" sway on top of the idle animation.
    this.character.rotation.y = Math.sin(t * 0.35) * 0.08;

    this.rings.forEach((r, i) => {
      r.rotation.z += dt * (i % 2 ? -0.25 : 0.4) * (1 + this.activity) * this.spin;
      // Rings ripple outward with the live audio level.
      r.scale.setScalar(1 + this.smoothLevel * (0.06 + i * 0.03));
    });
    const beamMat = this.beam.material as THREE.ShaderMaterial;
    beamMat.uniforms.uStrength.value = 0.25 + this.reveal * 0.75 + this.activity + this.energy * 0.25 + this.smoothLevel * 0.2;
    (beamMat.uniforms.uColor.value as THREE.Color).copy(this.color);

    const p = this.particles.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (0.12 + (i % 7) * 0.03) * (1 + this.energy * 3);
      if (y > 2.6) y = 0;
      p.setY(i, y);
    }
    p.needsUpdate = true;

    this.controls.update();
    this.bloom.strength = this.quality === 'high' ? 0.75 + this.activity * 0.6 + this.smoothLevel * 0.25 + thinkingPulse * 0.5 : 0;
    if (this.quality === 'high') this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
