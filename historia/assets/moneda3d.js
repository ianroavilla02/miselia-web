window.Moneda3D = async function (THREE, RoomEnvironment, coin, texA, texB) {
  var SEGUNDOS_POR_VUELTA = 10;
  var PAD = 1.36, T = 0.12;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var canvas = document.createElement('canvas');
  canvas.className = 'coin-gl';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.visibility = 'hidden';

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  var scene = new THREE.Scene();
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, PAD / Math.tan(THREE.MathUtils.degToRad(15)));

  scene.add(new THREE.HemisphereLight(0xfff0d2, 0x2a1808, 0.55));
  var key = new THREE.DirectionalLight(0xffdcaa, 1.7); key.position.set(-4, 2.6, 2.4); scene.add(key);
  var rim = new THREE.PointLight(0xffb060, 8, 0, 2); rim.position.set(2.6, -1.8, 1.6); scene.add(rim);

  var loader = new THREE.TextureLoader();
  var tex = await Promise.all([loader.loadAsync(texA), loader.loadAsync(texB)]);
  var ta = tex[0], tb = tex[1];
  [ta, tb].forEach(function (t) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });

  var relieve = function (img, N, fuerza) {
    var c = document.createElement('canvas'); c.width = c.height = N;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, N, N);
    var a = x.getImageData(0, 0, N, N).data;
    var m = document.createElement('canvas'); m.width = m.height = 20;
    m.getContext('2d').drawImage(img, 0, 0, 20, 20);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(m, 0, 0, N, N);
    var b = x.getImageData(0, 0, N, N).data;
    var h = new Float32Array(N * N);
    for (var i = 0, j = 0; i < h.length; i++, j += 4) {
      h[i] = ((a[j] * 0.299 + a[j + 1] * 0.587 + a[j + 2] * 0.114) - (b[j] * 0.299 + b[j + 1] * 0.587 + b[j + 2] * 0.114)) / 255;
    }
    var out = x.createImageData(N, N), o = out.data;
    var H = function (px, py) { return h[Math.min(N - 1, Math.max(0, py)) * N + Math.min(N - 1, Math.max(0, px))]; };
    for (var py = 0; py < N; py++) for (var px = 0; px < N; px++) {
      var gx = (H(px + 1, py - 1) + 2 * H(px + 1, py) + H(px + 1, py + 1)) - (H(px - 1, py - 1) + 2 * H(px - 1, py) + H(px - 1, py + 1));
      var gy = (H(px - 1, py + 1) + 2 * H(px, py + 1) + H(px + 1, py + 1)) - (H(px - 1, py - 1) + 2 * H(px, py - 1) + H(px + 1, py - 1));
      var nx = -gx * fuerza, ny = gy * fuerza, nz = 1;
      var l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      var k = (py * N + px) * 4;
      o[k] = (nx * 0.5 + 0.5) * 255; o[k + 1] = (ny * 0.5 + 0.5) * 255; o[k + 2] = (nz * 0.5 + 0.5) * 255; o[k + 3] = 255;
    }
    x.putImageData(out, 0, 0);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  var NR = (Math.min(innerWidth, innerHeight) < 600) ? 512 : 640;
  var na = relieve(ta.image, NR, 2.4), nb = relieve(tb.image, NR, 2.4);

  var face = function (t, n) {
    return new THREE.MeshStandardMaterial({ map: t, normalMap: n, normalScale: new THREE.Vector2(1, 1),
      metalness: 0.3, roughness: 0.58, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3,
      envMapIntensity: 0.32, toneMapped: false });
  };

  var sc = document.createElement('canvas'); sc.width = 32; sc.height = 2;
  var g = sc.getContext('2d');
  for (var xx = 0; xx < 32; xx++) {
    var v = Math.round(128 + 120 * Math.cos(xx / 32 * Math.PI * 2));
    g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(xx, 0, 1, 2);
  }
  var reed = new THREE.CanvasTexture(sc);
  reed.wrapS = reed.wrapT = THREE.RepeatWrapping; reed.repeat.set(220, 1);
  var edgeMat = new THREE.MeshStandardMaterial({ color: 0xc99a52, metalness: 0.9, roughness: 0.52, bumpMap: reed, bumpScale: 1.4, envMapIntensity: 0.7 });

  var group = new THREE.Group();
  var edgeGeo = new THREE.CylinderGeometry(1, 1, T, 192, 1, true); edgeGeo.rotateX(Math.PI / 2);
  group.add(new THREE.Mesh(edgeGeo, edgeMat));
  var faceGeo = new THREE.CircleGeometry(1, 192);
  var fa = new THREE.Mesh(faceGeo, face(ta, na)); fa.position.z = T / 2; group.add(fa);
  var fb = new THREE.Mesh(faceGeo, face(tb, nb)); fb.position.z = -T / 2; fb.rotation.y = Math.PI; group.add(fb);
  scene.add(group);

  var X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  var REST_A = new THREE.Quaternion();
  var REST_B = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI);
  var q = new THREE.Quaternion();
  var tmp = new THREE.Quaternion(), tiltQ = new THREE.Quaternion(), eul = new THREE.Euler();
  var vel = { x: 0, y: 0 };
  var tilt = { x: 0, y: 0 }, aim = { x: 0, y: 0, t: -1e9 };
  var drag = null, releasedAt = -1e9;
  var giro = 0;
  var twist = new THREE.Quaternion();

  var spin = function (ax, ay) {
    if (ax) q.premultiply(tmp.setFromAxisAngle(Y, ax));
    if (ay) q.premultiply(tmp.setFromAxisAngle(X, ay));
  };
  var inside = function (e) {
    var r = coin.getBoundingClientRect();
    return Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) <= r.width * 0.54;
  };

  canvas.addEventListener('pointerdown', function (e) {
    if (!inside(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), w: coin.getBoundingClientRect().width,
             espera: e.pointerType !== 'mouse', sx: e.clientX, sy: e.clientY };
    if (!drag.espera) vel.x = vel.y = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    canvas.classList.add('agarrada');
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) { canvas.style.cursor = inside(e) ? 'grab' : ''; return; }
    if (e.pointerId !== drag.id) return;
    if (drag.espera) {
      var ddx = e.clientX - drag.sx, ddy = e.clientY - drag.sy;
      if (Math.hypot(ddx, ddy) < 8) return;
      if (Math.abs(ddx) < Math.abs(ddy) * 1.2) { drag = null; canvas.classList.remove('agarrada'); return; }
      drag.espera = false; drag.x = e.clientX; drag.y = e.clientY; drag.t = performance.now(); vel.x = vel.y = 0;
      return;
    }
    var now = performance.now(), dt = Math.max((now - drag.t) / 1000, 1 / 240);
    var k = Math.PI / drag.w;
    var ax = (e.clientX - drag.x) * k, ay = (e.clientY - drag.y) * k;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.abs(ax) > 1.6 || Math.abs(ay) > 1.6) { drag.t = now; return; }
    spin(ax, ay);
    vel.x = vel.x * 0.4 + (ax / dt) * 0.6; vel.y = vel.y * 0.4 + (ay / dt) * 0.6;
    drag.t = now;
  });
  var soltar = function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (performance.now() - drag.t > 90 || e.type === 'pointercancel') vel.x = vel.y = 0;
    if (reduce.matches) vel.x = vel.y = 0;
    drag = null; releasedAt = performance.now();
    canvas.classList.remove('agarrada');
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);

  addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    aim.x = (e.clientX / innerWidth) * 2 - 1;
    aim.y = (e.clientY / innerHeight) * 2 - 1;
    aim.t = performance.now();
  }, { passive: true });

  var resize = function () {
    var size = Math.max(1, Math.round(coin.clientWidth * PAD));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * calidad);
    renderer.setSize(size, size, false);
  };
  new ResizeObserver(resize).observe(coin);
  resize();

  var activo = false, last = performance.now(), raf = 0, logo = false, nextSpin = 0, spinT = -1, baseSize = 1, calidad = 1;
  var frame = function (now) {
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    var calm = reduce.matches;
    if (drag) giro = 0;
    else {
      var sp = Math.hypot(vel.x, vel.y);
      if (sp > 0.02) {
        spin(vel.x * dt, vel.y * dt);
        var damp = Math.exp(-dt * 2.6);
        vel.x *= damp; vel.y *= damp;
      }
      if (now - releasedAt > 450 && sp < 1.4 && spinT < 0) {
        if (logo) {
          q.slerp(REST_A, 1 - Math.exp(-dt * 2.4));
        } else if (calm) {
          var rest = Math.abs(q.dot(REST_A)) >= Math.abs(q.dot(REST_B)) ? REST_A : REST_B;
          q.slerp(rest, 1 - Math.exp(-dt * 2.2));
        } else {
          twist.set(0, q.y, 0, q.w);
          if (twist.lengthSq() > 1e-6) q.slerp(twist.normalize(), 1 - Math.exp(-dt * 2.2));
        }
      }
      if (logo) {
        giro = 0;
        if (!calm && spinT < 0 && now > nextSpin && now - releasedAt > 1800) spinT = 0;
        if (spinT >= 0) {
          var e0 = Math.min(1, spinT / 2.6); spinT += dt; var e1 = Math.min(1, spinT / 2.6);
          var sm = function (x) { return x * x * (3 - 2 * x); };
          spin((sm(e1) - sm(e0)) * Math.PI * 2, 0);
          if (spinT >= 2.6) { spinT = -1; nextSpin = now + 8000 + Math.random() * 5000; }
        }
      } else {
      if (!calm && now - releasedAt > 300) giro = Math.min(1, giro + dt / 2);
      if (calm) giro = 0;
      var kk = giro * giro * (3 - 2 * giro);
      if (kk > 0) spin(kk * dt * Math.PI * 2 / SEGUNDOS_POR_VUELTA, 0);
      }
    }
    var tx = 0, ty = 0;
    if (!calm && !drag) {
      if (now - aim.t < 4000) { tx = aim.y * 0.26; ty = aim.x * 0.36; }
      else { tx = Math.sin(now / 1000 * 0.55) * 0.07; }
    }
    var f = 1 - Math.exp(-dt * 3);
    tilt.x += (tx - tilt.x) * f; tilt.y += (ty - tilt.y) * f;
    tiltQ.setFromEuler(eul.set(tilt.x, tilt.y, 0));
    group.quaternion.copy(tiltQ).multiply(q);
    renderer.render(scene, camera);
    raf = activo ? requestAnimationFrame(frame) : 0;
  };

  coin.appendChild(canvas);
  renderer.render(scene, camera);
  canvas.style.visibility = '';
  coin.classList.add('is-3d');

  return {
    modoLogo: function (v) { logo = !!v; spinT = -1; nextSpin = performance.now() + 2500; },
    calidad: function (f) { calidad = f; resize(); },
    activar: function (v) {
      activo = !!v;
      if (activo && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }
  };
};
