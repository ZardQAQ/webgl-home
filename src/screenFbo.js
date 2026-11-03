import * as THREE from "three";

/**
 * Offscreen screen content:
 * noise (white + height alpha) → normal/AO → compose for mesh displacement.
 */
export function createScreenFbo(renderer, resolution = 512) {
  const size = new THREE.Vector2(resolution, resolution);

  function makeTarget(type = THREE.HalfFloatType) {
    const t = new THREE.WebGLRenderTarget(resolution, resolution, {
      type,
      format: THREE.RGBAFormat,
      colorSpace: THREE.NoColorSpace,
      depthBuffer: false,
      stencilBuffer: false,
    });
    t.texture.generateMipmaps = false;
    t.texture.minFilter = THREE.LinearFilter;
    t.texture.magFilter = THREE.LinearFilter;
    t.texture.wrapS = THREE.ClampToEdgeWrapping;
    t.texture.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }

  const noiseRT = makeTarget();
  const aoRT = makeTarget();
  const composeRT = makeTarget(THREE.UnsignedByteType);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  scene.add(quad);

  const shared = {
    iTime: { value: 0 },
    iResolution: { value: size.clone() },
    iMouse: { value: new THREE.Vector2(-1000, -1000) },
    u_screenTextureSize: { value: size.clone() },
    u_colorA: { value: new THREE.Color(0.78, 0.86, 1.0) },
    u_colorB: { value: new THREE.Color(0.95, 0.98, 1.0) },
    u_colorC: { value: new THREE.Color(0.7, 0.82, 1.0) },
    u_tint: { value: new THREE.Color(0.92, 0.96, 1.05) },
  };

  const noiseMat = new THREE.ShaderMaterial({
    uniforms: {
      iTime: shared.iTime,
      iResolution: shared.iResolution,
      iMouse: shared.iMouse,
      u_colorA: shared.u_colorA,
      u_colorB: shared.u_colorB,
      u_colorC: shared.u_colorC,
    },
    vertexShader: /* glsl */ `
      varying vec2 v_uv;
      void main(){ v_uv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec2 iMouse;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      uniform vec3 u_colorC;
      varying vec2 v_uv;

      vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
      vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v){
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + 2.0*C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0*C.xxx;
        i = mod(i, 289.0);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 1.0/7.0;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
        m *= m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
      }

      float fbm(vec3 p){
        float f = 0.0;
        f += 0.5000*snoise(p); p = p*2.02;
        f += 0.2500*snoise(p); p = p*2.03;
        f += 0.1250*snoise(p); p = p*2.01;
        f += 0.0625*snoise(p);
        return f/0.9375;
      }

      float pattern(vec3 p){
        vec3 q = vec3(fbm(p), fbm(p + vec3(5.2,1.3,2.0)), 0.0);
        return fbm(p + 4.0*q);
      }

      void main(){
        vec2 uv = v_uv;
        float mouseRatio = smoothstep(100.0, 0.0, length(iMouse.xy - uv * iResolution));
        float noise = 0.25 + pattern(vec3(uv * 0.75, iTime * 0.05 + 0.1 * mouseRatio)) * 0.75;
        vec3 cool = mix(u_colorA, u_colorB, noise);
        cool = mix(cool, u_colorC, 0.15 * mouseRatio);
        gl_FragColor = vec4(cool, clamp(noise, 0.0, 1.0));
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  const aoMat = new THREE.ShaderMaterial({
    defines: { SAMEPLE_COUNT: 24 },
    uniforms: {
      u_screenTextureSize: shared.u_screenTextureSize,
      u_screenNoiseTexture: { value: noiseRT.texture },
      u_screenHeightScale: { value: 0.1 },
      u_screenAOSampleRange: { value: 0.1 },
      u_noiseOffset: { value: new THREE.Vector2() },
    },
    vertexShader: /* glsl */ `
      varying vec2 v_uv;
      void main(){ v_uv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec2 u_screenTextureSize;
      uniform vec2 u_noiseOffset;
      uniform sampler2D u_screenNoiseTexture;
      uniform float u_screenHeightScale;
      uniform float u_screenAOSampleRange;
      varying vec2 v_uv;

      const float PI2 = 6.2831853;
      vec2 poissonDisk[SAMEPLE_COUNT];

      void initPoissonSamples(float noise) {
        float ANGLE_STEP = PI2 * 4.0 / float(SAMEPLE_COUNT);
        float INV = 1.0 / float(SAMEPLE_COUNT);
        float angle = noise * PI2;
        float radius = INV;
        float radiusStep = radius;
        for (int i = 0; i < SAMEPLE_COUNT; i++) {
          poissonDisk[i] = vec2(cos(angle), sin(angle)) * pow(radius, 0.75);
          radius += radiusStep;
          angle += ANGLE_STEP;
        }
      }

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      void main() {
        float center = texture2D(u_screenNoiseTexture, v_uv).a;
        vec2 texelSize = 1.0 / u_screenTextureSize;
        vec3 dX = vec3(
          texelSize.x * 2.0, 0.0,
          (texture2D(u_screenNoiseTexture, v_uv + vec2(texelSize.x, 0.0)).a
         - texture2D(u_screenNoiseTexture, v_uv - vec2(texelSize.x, 0.0)).a) * u_screenHeightScale
        );
        vec3 dY = vec3(
          0.0, texelSize.y * 2.0,
          (texture2D(u_screenNoiseTexture, v_uv + vec2(0.0, texelSize.y)).a
         - texture2D(u_screenNoiseTexture, v_uv - vec2(0.0, texelSize.y)).a) * u_screenHeightScale
        );
        vec3 n = normalize(cross(dX, dY)) * 0.5 + 0.5;
        initPoissonSamples(hash12((v_uv + u_noiseOffset) * 100.0));

        float sum = 0.0;
        for (int i = 0; i < SAMEPLE_COUNT; i++) {
          float r = texture2D(u_screenNoiseTexture, v_uv + poissonDisk[i] * u_screenAOSampleRange).a;
          sum += max(0.0, r - center);
        }
        float ao = 1.0 - sum / float(SAMEPLE_COUNT);
        gl_FragColor = vec4(n.x, n.y, ao * ao * ao, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  const composeMat = new THREE.ShaderMaterial({
    uniforms: {
      u_screenNoiseTexture: { value: noiseRT.texture },
      u_screenNormalAOTexture: { value: aoRT.texture },
      u_tint: shared.u_tint,
    },
    vertexShader: /* glsl */ `
      varying vec2 v_uv;
      void main(){ v_uv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D u_screenNoiseTexture;
      uniform sampler2D u_screenNormalAOTexture;
      uniform vec3 u_tint;
      varying vec2 v_uv;

      void main() {
        vec4 screenInfo = texture2D(u_screenNoiseTexture, v_uv);
        vec3 shade = texture2D(u_screenNormalAOTexture, v_uv).rgb;
        vec3 n = vec3(shade.rg * 2.0 - 1.0, 0.0);
        n.z = sqrt(max(0.0, 1.0 - n.x * n.x - n.y * n.y));

        float ao = shade.b;
        vec3 color = screenInfo.rgb * (0.3 + 0.7 * ao);
        float f = max(dot(n, vec3(0.5774)), 0.0);
        color *= mix(0.75, 1.0, f * f * 0.3 + f * 0.7);
        color *= u_tint;

        gl_FragColor = vec4(color, screenInfo.a);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  function blit(mat, target) {
    quad.material = mat;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(prev);
  }

  function update(time, pointer01) {
    shared.iTime.value = time;
    if (pointer01) {
      shared.iMouse.value.set(pointer01.x * resolution, pointer01.y * resolution);
    }
    aoMat.uniforms.u_noiseOffset.value.set((time * 0.07) % 1, (time * 0.11) % 1);
  }

  function render() {
    blit(noiseMat, noiseRT);
    blit(aoMat, aoRT);
    blit(composeMat, composeRT);
  }

  function setPalette({ colorA, colorB, colorC, tint }) {
    if (colorA) shared.u_colorA.value.set(colorA);
    if (colorB) shared.u_colorB.value.set(colorB);
    if (colorC) shared.u_colorC.value.set(colorC);
    if (tint) shared.u_tint.value.set(tint);
  }

  return {
    texture: composeRT.texture,
    resolution,
    update,
    render,
    setPalette,
  };
}
