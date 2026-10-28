import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCandy, PALETTE } from './candy.js';

// ---------------------------------------------------------------- candy slots in the bowl (13, naturally)

const SLOTS = (() => {
  const raw = [];
  for (let i = 0; i < 5; i++) raw.push({ r: 0.95, a: (i / 5) * Math.PI * 2, y: 0.42 });
  for (let i = 0; i < 6; i++) raw.push({ r: 1.42, a: ((i + 0.5) / 6) * Math.PI * 2, y: 0.9 });
  for (let i = 0; i < 2; i++) raw.push({ r: 0.45, a: i * Math.PI + 0.6, y: 1.32 });
  return raw.map(({ r, a, y }) => ({
    pos: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
    yaw: -a - Math.PI / 2, // lie tangentially around the bowl
  }));
})();

// ---------------------------------------------------------------- tiny tween helpers

const ease = {
  outCubic: (k) => 1 - (1 - k) ** 3,
  outBack: (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2,
  outBounce: (k) => {
    const n = 7.5625, d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
  },
};

export function createScene(container, { onPick }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const BG = 0x0b0612;
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.04);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 5.2, 7.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.7, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 16;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.35;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;

  // ---------------------------------------------------------------- lights

  scene.add(new THREE.HemisphereLight(0x6b4fa0, 0x1a0a05, 0.6));

  const spot = new THREE.SpotLight(0xffe2c4, 140, 25, 0.55, 0.6);
  spot.position.set(2, 8, 3);
  spot.target.position.set(0, 0.5, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0005;
  scene.add(spot, spot.target);

  const rim = new THREE.PointLight(0x8e44ff, 40, 20);
  rim.position.set(-4, 3, -3);
  scene.add(rim);

  const flash = new THREE.PointLight(0xffe9a8, 0, 6);
  scene.add(flash);

  // ---------------------------------------------------------------- table, moon

  const table = new THREE.Mesh(
    new THREE.CircleGeometry(14, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x24140c, roughness: 0.9 }),
  );
  table.receiveShadow = true;
  scene.add(table);

  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 48),
    new THREE.MeshBasicMaterial({ color: 0xfff1c9, fog: false }),
  );
  moon.position.set(-9, 9, -26);
  scene.add(moon);

  // ---------------------------------------------------------------- pumpkin bowl

  const bowlProfile = [
    [0, 0], [1.0, 0.02], [1.7, 0.3], [2.1, 0.8], [2.3, 1.35], [2.36, 1.42], [2.28, 1.48],
    [2.18, 1.38], [2.0, 0.85], [1.6, 0.38], [0.95, 0.12], [0, 0.1],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const faceTex = makePumpkinTextures(bowlProfile.length - 1);
  const bowlMat = new THREE.MeshStandardMaterial({
    map: faceTex.color,
    emissiveMap: faceTex.glow,
    emissive: 0xffb347,
    emissiveIntensity: 1.2,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 72, -Math.PI, Math.PI * 2), bowlMat);
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  scene.add(bowl);

  // ---------------------------------------------------------------- candles

  const candles = [[-3.2, 1.6, 1.0], [3.3, -0.6, 1.3], [-1.6, -3.0, 0.7]].map(([x, z, h]) => {
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.2, h, 20),
      new THREE.MeshStandardMaterial({ color: 0xf3e6cf, roughness: 0.6 }),
    );
    wax.position.set(x, h / 2, z);
    wax.castShadow = true;
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 8).scale(1, 1.9, 1),
      new THREE.MeshBasicMaterial({ color: 0xffc46b }),
    );
    flame.position.set(x, h + 0.14, z);
    const light = new THREE.PointLight(0xff8a2a, 6, 9);
    light.position.set(x, h + 0.3, z);
    scene.add(wax, flame, light);
    return { flame, light, seed: Math.random() * 100 };
  });

  // ---------------------------------------------------------------- drifting embers

  const EMBERS = 260;
  const emberPos = new Float32Array(EMBERS * 3);
  for (let i = 0; i < EMBERS; i++) {
    emberPos[i * 3] = (Math.random() - 0.5) * 18;
    emberPos[i * 3 + 1] = Math.random() * 7;
    emberPos[i * 3 + 2] = (Math.random() - 0.5) * 18;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({
    color: 0xffa64d, size: 0.06, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(embers);

  // ---------------------------------------------------------------- bats

  const batMat = new THREE.MeshBasicMaterial({ color: 0x050208, side: THREE.DoubleSide });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(0.55, 0.12);
  wingShape.lineTo(0.42, -0.05);
  wingShape.lineTo(0.3, 0.02);
  wingShape.lineTo(0.16, -0.08);
  wingShape.lineTo(0, -0.04);
  const wingGeo = new THREE.ShapeGeometry(wingShape).rotateX(-Math.PI / 2);
  const bats = Array.from({ length: 4 }, (_, i) => {
    const bat = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.8, 1.6), batMat);
    const left = new THREE.Mesh(wingGeo, batMat);
    const right = new THREE.Mesh(wingGeo, batMat);
    right.scale.x = -1;
    bat.add(body, left, right);
    scene.add(bat);
    return { bat, left, right, r: 5 + i * 1.3, h: 3 + (i % 2) * 1.5, speed: 0.25 + i * 0.07, phase: i * 1.7 };
  });

  // ---------------------------------------------------------------- candy state

  let candies = [];
  const tweens = [];
  const animate = (fn) => tweens.push(fn);

  function fill() {
    for (const c of candies) removeCandy(c);
    candies = SLOTS.map((slot, i) => {
      const c = createCandy(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
      c.index = i;
      c.slot = slot;
      c.state = 'dropping';
      c.hover = 0;
      c.base = slot.pos.clone();
      c.roll = Math.random() * Math.PI * 2;
      c.tilt = (Math.random() - 0.5) * 0.35;
      for (const m of c.meshes) m.userData.candy = c;
      c.group.rotation.set(c.roll, slot.yaw + (Math.random() - 0.5) * 0.3, c.tilt);
      c.group.position.set(c.base.x, c.base.y + 6 + i * 0.3, c.base.z);
      scene.add(c.group);

      const fromY = c.group.position.y;
      const delay = i * 0.07;
      let t = -delay;
      animate((dt) => {
        t += dt;
        const k = Math.min(Math.max(t / 0.8, 0), 1);
        c.group.position.y = fromY + (c.base.y - fromY) * ease.outBounce(k);
        if (k < 1) return true;
        c.state = 'idle';
        return false;
      });
      return c;
    });
  }

  function removeCandy(c) {
    c.state = 'gone';
    let t = 0;
    const s0 = c.group.scale.clone();
    animate((dt) => {
      t += dt;
      const k = Math.min(t / 0.25, 1);
      c.group.scale.copy(s0).multiplyScalar(1 - k);
      if (k < 1) return true;
      scene.remove(c.group);
      c.dispose();
      return false;
    });
  }

  function reveal(index, { onPop } = {}) {
    const c = candies[index];
    if (!c || c.state !== 'idle') return false;
    c.state = 'opening';
    c.setGlow(0.6);
    const start = c.group.position.clone();
    const top = new THREE.Vector3(start.x * 0.4, start.y + 1.9, start.z * 0.4);
    let t = 0;
    let popped = false;
    animate((dt) => {
      t += dt;
      if (t < 0.7) {
        const k = ease.outCubic(t / 0.7);
        c.group.position.lerpVectors(start, top, k);
        c.group.position.x += Math.sin(t * 70) * 0.05 * k;
        c.group.rotation.x += dt * (6 + 30 * k); // twist the wrapper
        c.group.scale.setScalar(1 + 0.2 * k);
        return true;
      }
      if (!popped) {
        popped = true;
        c.group.visible = false;
        burst(c.group.position, c.color);
        onPop?.();
      }
      if (t < 1.5) return true;
      // Leave an empty, flattened wrapper behind.
      c.toWrapper();
      c.state = 'wrapper';
      c.group.visible = true;
      c.group.position.set(start.x, start.y - 0.12, start.z);
      c.group.rotation.set(0, c.slot.yaw, c.tilt);
      const target = new THREE.Vector3(1, 0.3, 0.8);
      let w = 0;
      animate((dt2) => {
        w += dt2;
        const k = Math.min(w / 0.35, 1);
        c.group.scale.copy(target).multiplyScalar(ease.outBack(k));
        return k < 1;
      });
      return false;
    });
    return true;
  }

  // ---------------------------------------------------------------- confetti burst

  const confettiGeo = new THREE.PlaneGeometry(0.09, 0.14);
  function burst(origin, color) {
    flash.position.copy(origin);
    flash.intensity = 60;
    const colors = [color, 0xfff4e0, 0xffd23f, color];
    const bits = Array.from({ length: 46 }, (_, i) => {
      const m = new THREE.Mesh(confettiGeo, new THREE.MeshBasicMaterial({
        color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true,
      }));
      m.position.copy(origin);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize();
      m.userData.v = dir.multiplyScalar(2.5 + Math.random() * 3.5);
      m.userData.spin = new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0);
      scene.add(m);
      return m;
    });
    let t = 0;
    animate((dt) => {
      t += dt;
      for (const m of bits) {
        m.userData.v.y -= 6 * dt;
        m.userData.v.multiplyScalar(0.985);
        m.position.addScaledVector(m.userData.v, dt);
        if (m.position.y < 0.02) {
          m.position.y = 0.02;
          m.userData.v.set(0, 0, 0);
        } else {
          m.rotation.x += m.userData.spin.x * dt;
          m.rotation.y += m.userData.spin.y * dt;
        }
        m.material.opacity = Math.min(1, 3 - t);
      }
      if (t < 3) return true;
      for (const m of bits) {
        scene.remove(m);
        m.material.dispose();
      }
      return false;
    });
  }

  // ---------------------------------------------------------------- picking

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  let downAt = null;

  function hit(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const pickable = candies.filter((c) => c.state === 'idle').flatMap((c) => c.meshes);
    return raycaster.intersectObjects(pickable, false)[0]?.object.userData.candy ?? null;
  }

  const canvas = renderer.domElement;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    hovered = hit(e);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  });
  canvas.addEventListener('pointerleave', () => { hovered = null; });
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return; // that was a drag to orbit
    const c = hit(e);
    if (c) onPick(c.index);
  });

  function pickRandom() {
    const idle = candies.filter((c) => c.state === 'idle');
    if (!idle.length) return false;
    onPick(idle[Math.floor(Math.random() * idle.length)].index);
    return true;
  }

  // ---------------------------------------------------------------- resize + loop

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Back the camera off on portrait screens so the whole bowl fits.
    const dist = camera.aspect < 1 ? 8.9 / Math.max(camera.aspect, 0.45) ** 0.85 : 8.9;
    const offset = camera.position.clone().sub(controls.target).setLength(dist);
    camera.position.copy(controls.target).add(offset);
  }
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;

    for (let i = tweens.length - 1; i >= 0; i--) {
      if (!tweens[i](dt)) tweens.splice(i, 1);
    }

    for (const c of candies) {
      if (c.state !== 'idle') continue;
      c.hover += ((c === hovered ? 1 : 0) - c.hover) * Math.min(1, dt * 12);
      c.group.position.y = c.base.y + c.hover * 0.22 + Math.sin(time * 1.5 + c.index) * 0.012;
      c.setGlow(c.hover * 0.45);
    }

    flash.intensity *= 0.9;

    for (const { flame, light, seed } of candles) {
      const f = 0.75 + Math.sin(time * 11 + seed) * 0.1 + Math.sin(time * 23 + seed * 2) * 0.08 + Math.random() * 0.07;
      light.intensity = 6 * f;
      flame.scale.set(1, f, 1);
    }
    bowlMat.emissiveIntensity = 1.0 + Math.sin(time * 9) * 0.08 + Math.random() * 0.1;

    const p = emberGeo.attributes.position;
    for (let i = 0; i < EMBERS; i++) {
      let y = p.getY(i) + dt * 0.25;
      if (y > 7) y = 0;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(time + i) * dt * 0.08);
    }
    p.needsUpdate = true;

    for (const b of bats) {
      const a = time * b.speed + b.phase;
      b.bat.position.set(Math.cos(a) * b.r, b.h + Math.sin(a * 3) * 0.4, Math.sin(a) * b.r - 2);
      b.bat.rotation.y = -a;
      const flap = Math.sin(time * 18 + b.phase) * 0.8;
      b.left.rotation.z = flap;
      b.right.rotation.z = -flap;
    }

    controls.update();
    renderer.render(scene, camera);
  });

  return { count: SLOTS.length, fill, reveal, pickRandom };
}

// ---------------------------------------------------------------- pumpkin textures

/**
 * Lathe UVs: u wraps around the bowl (u=0.5 faces the camera thanks to phiStart=-PI),
 * v follows the profile points. `segments` is the number of profile segments.
 */
function makePumpkinTextures(segments) {
  const W = 1024, H = 1024;
  const vToY = (v) => (1 - v) * H; // canvas is flipped relative to UV v
  const outerTop = vToY(4 / segments); // profile point 4 = top of the outer wall
  const outerBottom = vToY(2 / segments); // below this the wall curves out of sight

  const color = document.createElement('canvas');
  color.width = W; color.height = H;
  const g = color.getContext('2d');
  g.fillStyle = '#e8641c';
  g.fillRect(0, 0, W, H);
  // Pumpkin ribs
  for (let i = 0; i < 12; i++) {
    const x = (i / 12) * W;
    const grad = g.createLinearGradient(x - 40, 0, x + 40, 0);
    grad.addColorStop(0, 'rgba(120,40,5,0)');
    grad.addColorStop(0.5, 'rgba(120,40,5,0.55)');
    grad.addColorStop(1, 'rgba(120,40,5,0)');
    g.fillStyle = grad;
    g.fillRect(x - 40, 0, 80, H);
  }
  // Darker inside of the bowl
  g.fillStyle = '#7a2e0a';
  g.fillRect(0, 0, W, vToY(7 / segments));

  const glow = document.createElement('canvas');
  glow.width = W; glow.height = H;
  const e = glow.getContext('2d');
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);

  const drawFace = (ctx, fill) => {
    ctx.fillStyle = fill;
    const cx = W / 2;
    const top = outerTop + (outerBottom - outerTop) * 0.06;
    const fh = (outerBottom - outerTop) * 0.85;
    const tri = (x1, y1, x2, y2, x3, y3) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
    };
    // eyes
    tri(cx - 70, top + fh * 0.42, cx - 45, top, cx - 18, top + fh * 0.42);
    tri(cx + 18, top + fh * 0.42, cx + 45, top, cx + 70, top + fh * 0.42);
    // nose
    tri(cx - 10, top + fh * 0.6, cx, top + fh * 0.46, cx + 10, top + fh * 0.6);
    // jagged grin
    ctx.beginPath();
    ctx.moveTo(cx - 95, top + fh * 0.66);
    const teeth = [[-70, 0.78], [-55, 0.7], [-35, 0.82], [-15, 0.72], [5, 0.84], [25, 0.72], [45, 0.82], [62, 0.7], [80, 0.78]];
    teeth.forEach(([dx, k]) => ctx.lineTo(cx + dx, top + fh * k));
    ctx.lineTo(cx + 95, top + fh * 0.66);
    ctx.quadraticCurveTo(cx, top + fh * 1.12, cx - 95, top + fh * 0.66);
    ctx.fill();
  };
  drawFace(g, '#2a0d02');
  drawFace(e, '#ffcc55');

  const tex = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { color: tex(color, true), glow: tex(glow, true) };
}
