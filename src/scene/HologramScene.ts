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
  private activity = 0; // 0..1, drives glow pulses (used by voice later)
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
      const ring = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: BLUE, transparent: true, opacity: d.o,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
        }),
      );
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
        uniforms: { uColor: { value: BLUE }, uStrength: { value: 0.0 } },
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
    const pulse = 1 + this.activity * 0.6 + Math.sin(t * 2) * 0.04;

    for (const m of this.holoMaterials) {
      m.uniforms.uTime.value = t;
      m.uniforms.uReveal.value = this.reveal;
      m.uniforms.uIntensity.value = pulse;
    }
    this.mixer?.update(dt);
    // Subtle "alive" sway on top of the idle animation.
    this.character.rotation.y = Math.sin(t * 0.35) * 0.08;

    this.rings.forEach((r, i) => (r.rotation.z += dt * (i % 2 ? -0.25 : 0.4) * (1 + this.activity)));
    (this.beam.material as THREE.ShaderMaterial).uniforms.uStrength.value = 0.25 + this.reveal * 0.75 + this.activity;

    const p = this.particles.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (0.12 + (i % 7) * 0.03);
      if (y > 2.6) y = 0;
      p.setY(i, y);
    }
    p.needsUpdate = true;

    this.controls.update();
    this.bloom.strength = this.quality === 'high' ? 0.75 + this.activity * 0.6 : 0;
    if (this.quality === 'high') this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
