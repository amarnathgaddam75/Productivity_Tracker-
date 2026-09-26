// Particle "body" renderer (WebGL1, no dependencies).
//
// Tens of thousands of additive-blended points morph between a set of target
// shapes, drift with a gentle swirl and scatter away from the pointer. All the
// per-frame work happens in the vertex shader, so it stays smooth on phones.
//
//   const orb = createOrb(canvas, { count: 60000 });
//   orb.set({ shape: 'ring', color: '#5eead4', energy: 1 });
//   orb.destroy();
//
// Shapes: sphere · cube · ring (a clock face with hands) · galaxy · twin
// (two linked bodies — desktop + phone). `set()` eases toward new values; pass
// `weights` (one per shape) to blend shapes directly, e.g. while scrolling.

export const ORB_SHAPES = ['sphere', 'cube', 'ring', 'galaxy', 'twin'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rnd) {
  const u = Math.max(1e-9, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

function unitVector(rnd) {
  const z = rnd() * 2 - 1;
  const a = rnd() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a), z];
}

/** Generate target positions for every shape. Pure; exported for tests. */
export function generateShapes(count, seed = 7) {
  const rnd = mulberry32(seed);
  const out = {};
  for (const s of ORB_SHAPES) out[s] = new Float32Array(count * 3);
  const rand = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const o = i * 3;
    for (let k = 0; k < 4; k++) rand[i * 4 + k] = rnd();

    // sphere: dense, glowing volume that thins towards the rim
    {
      const [x, y, z] = unitVector(rnd);
      const r = Math.pow(rnd(), 0.62);
      out.sphere.set([x * r, y * r, z * r], o);
    }

    // cube: rounded box, mostly on its faces
    {
      const h = 0.62;
      let p = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1];
      if (rnd() < 0.7) {
        const axis = Math.floor(rnd() * 3);
        p[axis] = p[axis] < 0 ? -1 : 1;
      }
      const soft = 0.06 * gauss(rnd);
      out.cube.set(p.map((v) => v * h + soft * 0.3), o);
    }

    // ring: a clock face — torus plus twelve hour ticks and two hands
    {
      const pick = rnd();
      let p;
      if (pick < 0.78) {
        const a = rnd() * Math.PI * 2;
        const R = 0.9 + 0.035 * gauss(rnd);
        p = [Math.cos(a) * R, Math.sin(a) * R, 0.05 * gauss(rnd)];
      } else if (pick < 0.88) {
        const tick = Math.floor(rnd() * 12);
        const a = (tick / 12) * Math.PI * 2;
        const R = 0.7 + rnd() * 0.1;
        p = [Math.cos(a) * R + 0.01 * gauss(rnd), Math.sin(a) * R + 0.01 * gauss(rnd), 0.02 * gauss(rnd)];
      } else {
        const long = rnd() < 0.55;
        const a = long ? Math.PI / 2 : Math.PI / 2 - (Math.PI * 2 * 4) / 12; // 12 and 4 o'clock
        const len = (long ? 0.62 : 0.4) * rnd();
        p = [Math.cos(a) * len + 0.015 * gauss(rnd), Math.sin(a) * len + 0.015 * gauss(rnd), 0.02 * gauss(rnd)];
      }
      out.ring.set(p, o);
    }

    // galaxy: three-armed spiral disc
    {
      const arm = Math.floor(rnd() * 3);
      const d = Math.pow(rnd(), 0.8) * 1.15;
      const a = (arm / 3) * Math.PI * 2 + d * 2.6 + 0.35 * gauss(rnd) * (1.1 - d);
      const spread = 0.05 + 0.08 * d;
      out.galaxy.set(
        [Math.cos(a) * d + spread * gauss(rnd), Math.sin(a) * d + spread * gauss(rnd), 0.06 * gauss(rnd) * (1.2 - d)],
        o,
      );
    }

    // twin: a larger body (desktop) and a smaller one (phone) joined by a stream
    {
      const pick = rnd();
      let p;
      if (pick < 0.58) {
        const [x, y, z] = unitVector(rnd);
        const r = 0.5 * Math.pow(rnd(), 0.45);
        p = [x * r - 0.55, y * r, z * r];
      } else if (pick < 0.9) {
        const [x, y, z] = unitVector(rnd);
        const r = 0.32 * Math.pow(rnd(), 0.45);
        p = [x * r + 0.72, y * r, z * r];
      } else {
        const t = rnd();
        p = [-0.1 + t * 0.55, 0.04 * Math.sin(t * Math.PI * 4) + 0.025 * gauss(rnd), 0.025 * gauss(rnd)];
      }
      out.twin.set(p, o);
    }
  }
  return { shapes: out, rand };
}

const VERT = `
precision highp float;
attribute vec3 aS0; attribute vec3 aS1; attribute vec3 aS2; attribute vec3 aS3; attribute vec3 aS4;
attribute vec4 aR;
uniform vec4 uW; uniform float uW4;
uniform float uTime; uniform float uEnergy; uniform float uAspect; uniform float uScale;
uniform float uPoint; uniform vec2 uMouse; uniform float uMouseF; uniform vec2 uOffset;
uniform mat3 uRot; uniform mat3 uFace; uniform float uSpin; uniform float uAlpha;
varying float vA; varying float vCore;
vec3 spinZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }
void main() {
  // sphere + cube tumble freely; the flat shapes face the viewer and turn in place
  vec3 freeP = aS0 * uW.x + aS1 * uW.y;
  vec3 flatP = spinZ(aS2, -uSpin) * uW.z + spinZ(aS3, -uSpin * 0.5) * uW.w + aS4 * uW4;
  vCore = clamp(1.0 - length(freeP + flatP) / 1.05, 0.0, 1.0);
  float sp = (0.25 + aR.x * 0.75) * (0.35 + uEnergy * 1.3);
  float t = uTime * sp;
  float amp = 0.018 + 0.03 * uEnergy;
  vec3 jitter = amp * vec3(sin(t + aR.y * 6.2831), cos(t * 1.31 + aR.z * 6.2831), sin(t * 0.73 + aR.w * 6.2831));
  vec3 p = uRot * freeP + uFace * flatP + jitter;
  float persp = 3.2 / (p.z + 3.2);
  vec2 s = p.xy * persp * uScale;
  // fit the shorter side of the canvas
  s *= vec2(1.0 / max(uAspect, 1.0), min(uAspect, 1.0));
  s += uOffset;
  vec2 d = s - uMouse;
  vec2 da = d * vec2(uAspect, 1.0);
  float dist2 = dot(da, da);
  s += normalize(d + 1e-5) * uMouseF * (0.05 + aR.y * 0.12) * exp(-dist2 * 14.0);
  gl_Position = vec4(s, 0.0, 1.0);
  gl_PointSize = uPoint * (0.55 + aR.w * 0.9) * persp;
  vA = uAlpha * (0.45 + 0.55 * persp * persp) * (0.6 + 0.4 * aR.z);
}`;

const FRAG = `
precision mediump float;
uniform vec3 uColor;
varying float vA; varying float vCore;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float f = 1.0 - smoothstep(0.1, 0.5, length(c));
  vec3 col = mix(uColor, vec3(1.0), clamp(vCore * 1.25, 0.0, 1.0) * 0.9);
  float a = f * vA;
  gl_FragColor = vec4(col * a, a);
}`;

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rotation(yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  // R = Rx(pitch) * Ry(yaw), column-major
  return new Float32Array([cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy]);
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

export function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 * @param {number} [opts.count]   particle count
 * @param {number} [opts.scale]   size of the body relative to the canvas height
 * @param {number} [opts.point]   base point size in CSS px
 * @param {boolean} [opts.interactive] react to the pointer
 */
export function createOrb(canvas, opts = {}) {
  const reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const count = opts.count ?? 60000;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const { shapes, rand } = generateShapes(count, opts.seed ?? 7);
  const buffers = [];
  const bind = (name, data, size) => {
    const loc = gl.getAttribLocation(prog, name);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    buffers.push(buf);
  };
  ORB_SHAPES.forEach((s, i) => bind(`aS${i}`, shapes[s], 3));
  bind('aR', rand, 4);

  const U = {};
  for (const n of ['uW', 'uW4', 'uTime', 'uEnergy', 'uAspect', 'uScale', 'uPoint', 'uMouse', 'uMouseF', 'uOffset', 'uRot', 'uFace', 'uSpin', 'uAlpha', 'uColor'])
    U[n] = gl.getUniformLocation(prog, n);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // additive: overlapping particles glow white-hot

  // eased state
  const cur = { weights: [1, 0, 0, 0, 0], color: hexToRgb('#a78bfa'), energy: 0.4, brightness: 1, offset: [0, 0], scale: opts.scale ?? 0.75 };
  const tgt = { weights: [1, 0, 0, 0, 0], color: cur.color.slice(), energy: 0.4, brightness: 1, offset: [0, 0], scale: cur.scale };
  const mouse = { x: 9, y: 9, f: 0, tf: 0 };
  let yaw = 0.6, pitch = -0.35, spin = 0, last = performance.now(), time = 0, raf = 0, running = true, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function onPointer(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    mouse.tf = 1;
  }
  function onLeave() {
    mouse.tf = 0;
  }
  const target = opts.pointerTarget || window;
  if (opts.interactive !== false && !reduceMotion) {
    target.addEventListener('pointermove', onPointer, { passive: true });
    target.addEventListener('pointerleave', onLeave);
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  resize();

  const alphaBase = Math.min(0.9, 0.5 * Math.sqrt(60000 / count));

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = 1 - Math.exp(-dt * 3.2);
    for (let i = 0; i < 5; i++) cur.weights[i] += (tgt.weights[i] - cur.weights[i]) * k;
    for (let i = 0; i < 3; i++) cur.color[i] += (tgt.color[i] - cur.color[i]) * k;
    for (let i = 0; i < 2; i++) cur.offset[i] += (tgt.offset[i] - cur.offset[i]) * k;
    cur.energy += (tgt.energy - cur.energy) * k;
    cur.brightness += (tgt.brightness - cur.brightness) * k;
    cur.scale += (tgt.scale - cur.scale) * k;
    mouse.f += (mouse.tf - mouse.f) * (1 - Math.exp(-dt * 6));

    const motion = reduceMotion ? 0.15 : 1;
    time += dt * motion;
    yaw += dt * (0.08 + cur.energy * 0.25) * motion;
    spin += dt * (0.05 + cur.energy * 0.35) * motion;
    const p = pitch + Math.sin(time * 0.2) * 0.12;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const w = cur.weights;
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    gl.uniform4f(U.uW, w[0] / sum, w[1] / sum, w[2] / sum, w[3] / sum);
    gl.uniform1f(U.uW4, w[4] / sum);
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uEnergy, cur.energy);
    gl.uniform1f(U.uAspect, canvas.width / canvas.height);
    gl.uniform1f(U.uScale, cur.scale);
    gl.uniform1f(U.uPoint, (opts.point ?? 2.2) * dpr);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform1f(U.uMouseF, mouse.f);
    gl.uniform2f(U.uOffset, cur.offset[0], cur.offset[1]);
    gl.uniformMatrix3fv(U.uRot, false, rotation(yaw, p));
    gl.uniformMatrix3fv(U.uFace, false, rotation(Math.sin(time * 0.35) * 0.35, -0.12 + Math.sin(time * 0.27) * 0.1));
    gl.uniform1f(U.uSpin, spin);
    gl.uniform1f(U.uAlpha, alphaBase * cur.brightness * (0.75 + cur.energy * 0.35));
    gl.uniform3f(U.uColor, cur.color[0], cur.color[1], cur.color[2]);
    gl.drawArrays(gl.POINTS, 0, count);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const onVis = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', onVis);
  const onLost = (e) => {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(raf);
  };
  canvas.addEventListener('webglcontextlost', onLost);

  return {
    count,
    /** Ease toward a new look. */
    set({ shape, weights, color, energy, brightness, offset, scale, immediate } = {}) {
      if (shape) tgt.weights = ORB_SHAPES.map((s) => (s === shape ? 1 : 0));
      if (weights) tgt.weights = weights.slice(0, 5);
      if (color) tgt.color = hexToRgb(color);
      if (energy != null) tgt.energy = energy;
      if (brightness != null) tgt.brightness = brightness;
      if (offset) tgt.offset = offset.slice(0, 2);
      if (scale != null) tgt.scale = scale;
      if (immediate) {
        cur.weights = tgt.weights.slice();
        cur.color = tgt.color.slice();
        cur.energy = tgt.energy;
        cur.brightness = tgt.brightness;
        cur.offset = tgt.offset.slice();
        cur.scale = tgt.scale;
      }
    },
    /** Give the particles a kick (e.g. when a task is completed). */
    burst() {
      mouse.x = 0;
      mouse.y = 0;
      mouse.f = 3;
      mouse.tf = 0;
    },
    resize,
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      target.removeEventListener('pointermove', onPointer);
      target.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      buffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteProgram(prog);
    },
  };
}

/** Accent colours per timer state / landing section. */
export const ORB_COLORS = {
  violet: '#a78bfa',
  silver: '#c7d2fe',
  teal: '#5eead4',
  amber: '#fbbf24',
  rose: '#fb7185',
  sky: '#7dd3fc',
  emerald: '#6ee7b7',
};
