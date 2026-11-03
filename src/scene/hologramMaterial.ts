import * as THREE from 'three';

// A custom holographic shader that still supports skeletal animation (skinning),
// so the character can move while looking like a projected hologram:
// bright fresnel rim, moving scanlines, a sweeping scan band and subtle flicker.
export function createHologramMaterial(color = new THREE.Color('#29b6ff')) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uReveal: { value: 0 }, // 0 = invisible, 1 = fully materialized (bottom-up)
      uHeight: { value: 1.8 },
      uIntensity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vNormalV = normalize(transformedNormal);
        vViewDir = normalize(-mvPosition.xyz);
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uReveal;
      uniform float uHeight;
      uniform float uIntensity;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;

      float hash(float n) { return fract(sin(n) * 43758.5453); }

      void main() {
        float h = vWorldPos.y / uHeight;
        // materialize bottom -> top with a bright leading edge
        float edge = uReveal * 1.15 - 0.05;
        if (h > edge) discard;
        float leading = smoothstep(edge - 0.04, edge, h);

        float fres = pow(1.0 - abs(dot(normalize(vNormalV), normalize(vViewDir))), 2.2);
        float scan = 0.55 + 0.45 * sin(vWorldPos.y * 260.0 - uTime * 6.0);
        float band = smoothstep(0.08, 0.0, abs(fract(h * 0.6 - uTime * 0.18) - 0.5));
        float flicker = 0.92 + 0.08 * hash(floor(uTime * 24.0));

        float a = (0.03 + fres * 0.75) * scan + band * 0.18 + leading * 1.2;
        vec3 col = uColor * (0.25 + fres * 1.2 + band * 0.5) + vec3(0.6, 0.9, 1.0) * fres * fres * 0.6 + vec3(0.6, 0.9, 1.0) * leading;
        gl_FragColor = vec4(col * flicker * uIntensity, clamp(a * flicker, 0.0, 1.0) * uIntensity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
}
