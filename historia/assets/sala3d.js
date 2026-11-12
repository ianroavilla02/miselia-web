/* Dije Salamandra en 3D para «Tu compra». Módulo de _propuestas/brandbook-web/apartado-visual.html (Three.js 0.160.0), adaptado para vivir en un contenedor.
   Técnica: malla «inflada» desde la máscara alfa del dije (altura medida + domos en las esmeraldas), espalda espejada, oro PBR con normal map,
   y destellos en las gemas. Gira con vaivén suave, se inclina hacia el cursor, responde al scroll y se arrastra con el puntero.
   Uso: window.Sala3D(THREE, RoomEnvironment, contenedor, window.SALA_TEX) -> Promise<{ destruir }>. El render solo corre mientras el contenedor se ve. */
(function () {
  window.Sala3D = function (THREE, RoomEnvironment, cont, TEX) {
    var D = TEX.datos, CW = D.ancho, CH = D.alto;
    var GIRO_MAX = THREE.MathUtils.degToRad(55), SEGUNDOS_POR_VAIVEN = 9, PROF = 0.62, PAD = 1.18;

    var canvas = document.createElement('canvas');
    canvas.className = 'sala-gl';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.visibility = 'hidden';

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    var scene = new THREE.Scene();
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    pmrem.dispose();

    /* Cámara: en el plano z = 0, una unidad = un píxel del recorte */
    var FOV = 22;
    var camera = new THREE.PerspectiveCamera(FOV, CW / CH, 10, 20000);
    camera.position.set(0, 0, (CH * PAD / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));

    scene.add(new THREE.HemisphereLight(0xfff0d2, 0x2a1808, 0.5));
    var key = new THREE.DirectionalLight(0xffdcaa, 1.5); key.position.set(-4, 2.6, 3); scene.add(key);
    var rim = new THREE.DirectionalLight(0xffb060, 0.7); rim.position.set(3, -2, 1.2); scene.add(rim);

    var loader = new THREE.TextureLoader();
    return Promise.all([TEX.color, TEX.altura, TEX.normal, TEX.metal].map(function (u) { return loader.loadAsync(u); })).then(function (t) {
      var tCol = t[0], tAlt = t[1], tNor = t[2], tMet = t[3];
      tCol.colorSpace = THREE.SRGBColorSpace;
      [tCol, tNor, tMet].forEach(function (x) { x.anisotropy = renderer.capabilities.getMaxAnisotropy(); });

      /* Malla: plano subdividido; cada vértice sube según el mapa de alturas */
      var SX = 220, SY = Math.round(150 * CH / CW);
      var geo = new THREE.PlaneGeometry(CW, CH, SX, SY);
      var hc = document.createElement('canvas'); hc.width = SX + 1; hc.height = SY + 1;
      var hx = hc.getContext('2d', { willReadFrequently: true });
      hx.imageSmoothingQuality = 'high';
      hx.drawImage(tAlt.image, 0, 0, SX + 1, SY + 1);
      var hd = hx.getImageData(0, 0, SX + 1, SY + 1).data;
      var pos = geo.attributes.position;
      var Z = function (ix, iy) { return hd[(iy * (SX + 1) + ix) * 4] / 255 * D.hmax * PROF; };
      for (var i = 0; i < pos.count; i++) pos.setZ(i, Z(i % (SX + 1), Math.floor(i / (SX + 1))));
      geo.computeVertexNormals();

      var mat = new THREE.MeshStandardMaterial({
        map: tCol, alphaTest: 0.5, alphaToCoverage: true,
        normalMap: tNor, normalScale: new THREE.Vector2(0.55, 0.55),
        metalness: 0.62, roughness: 1.2, metalnessMap: tMet, roughnessMap: tMet,
        emissive: 0xffffff, emissiveMap: tCol, emissiveIntensity: 0.4, envMapIntensity: 0.55, toneMapped: false
      });
      var group = new THREE.Group();
      var frente = new THREE.Mesh(geo, mat);
      var espalda = new THREE.Mesh(geo, mat); espalda.scale.z = -1;
      var nucleo = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshStandardMaterial({
        map: tCol, color: 0x94703a, alphaTest: 0.5, metalness: 0.7, roughness: 0.45, envMapIntensity: 0.5, side: THREE.DoubleSide, toneMapped: false }));
      group.add(frente, espalda, nucleo);
      scene.add(group);

      /* Destellos de las esmeraldas: una estrella por gema y por cara */
      var sc = document.createElement('canvas'); sc.width = sc.height = 128;
      var g = sc.getContext('2d');
      var rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(235,255,245,1)'); rg.addColorStop(0.12, 'rgba(170,255,210,.7)'); rg.addColorStop(0.4, 'rgba(60,200,130,.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
      g.globalCompositeOperation = 'lighter';
      [[0, 2], [Math.PI / 2, 2], [Math.PI / 4, 1], [-Math.PI / 4, 1]].forEach(function (a) {
        g.save(); g.translate(64, 64); g.rotate(a[0]);
        var lg = g.createLinearGradient(-64, 0, 64, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(240,255,248,' + (a[1] === 2 ? 0.95 : 0.5) + ')'); lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg; g.fillRect(-64, -a[1], 128, a[1] * 2); g.restore();
      });
      var star = new THREE.CanvasTexture(sc);
      var destellos = [];
      D.gemas.forEach(function (gm, i) {
        var ix = Math.round(gm.u * SX), iy = Math.round((1 - gm.v) * SY);
        var x = (gm.u - 0.5) * CW, y = (gm.v - 0.5) * CH, z = Z(ix, iy) + 4;
        [1, -1].forEach(function (lado) {
          var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
          s.position.set(x, y, z * lado);
          s.scale.setScalar(gm.r * CW * 1.7);
          group.add(s);
          destellos.push({ s: s, lado: lado, fase: i * 1.9 + (lado < 0 ? 0.8 : 0) });
        });
      });

      /* ---------- Interacción ---------- */
      var rotY = 0, rotX = 0, fase = 0, rampa = 0, drag = null, releasedAt = -1e9;
      var vel = { x: 0, y: 0 }, tilt = { x: 0, y: 0 }, aim = { x: 0, y: 0, t: -1e9 }, scr = 0;
      var limitar = function () {
        rotY = Math.max(-GIRO_MAX, Math.min(GIRO_MAX, rotY));
        rotX = Math.max(-0.6, Math.min(0.6, rotX));
      };
      canvas.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), w: canvas.getBoundingClientRect().height / PAD * (CW / CH),
                 espera: e.pointerType !== 'mouse', sx: e.clientX, sy: e.clientY };
        if (!drag.espera) vel.x = vel.y = 0;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        canvas.classList.add('agarrada');
      });
      canvas.addEventListener('pointermove', function (e) {
        if (!drag) return;
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
        rotY += ax; rotX += ay; limitar();
        vel.x = vel.x * 0.4 + (ax / dt) * 0.6; vel.y = vel.y * 0.4 + (ay / dt) * 0.6;
        drag.t = now;
      });
      var soltar = function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (performance.now() - drag.t > 90 || e.type === 'pointercancel') vel.x = vel.y = 0;
        drag = null; releasedAt = performance.now();
        canvas.classList.remove('agarrada');
      };
      canvas.addEventListener('pointerup', soltar);
      canvas.addEventListener('pointercancel', soltar);
      var onMove = function (e) {
        if (e.pointerType !== 'mouse') return;
        aim.x = (e.clientX / innerWidth) * 2 - 1; aim.y = (e.clientY / innerHeight) * 2 - 1; aim.t = performance.now();
      };
      addEventListener('pointermove', onMove, { passive: true });

      /* ---------- Tamaño ---------- */
      var resize = function () {
        var w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
      };

      /* ---------- Bucle: solo mientras el contenedor se ve ---------- */
      var visible = false, last = performance.now(), raf = 0;
      var frame = function (now) {
        var dt = Math.min((now - last) / 1000, 0.05); last = now;
        if (!drag) {
          var sp = Math.hypot(vel.x, vel.y);
          if (sp > 0.02) {
            rotY += vel.x * dt; rotX += vel.y * dt; limitar();
            var damp = Math.exp(-dt * 2.6); vel.x *= damp; vel.y *= damp;
          }
          if (now - releasedAt > 450 && sp < 1.4) rotX += (0 - rotX) * (1 - Math.exp(-dt * 2.2));   /* se endereza */
          if (now - releasedAt > 300) rampa = Math.min(1, rampa + dt / 2.5);
          var k = rampa * rampa * (3 - 2 * rampa);
          if (k > 0) {                                                  /* vaivén suave, atado además al scroll */
            fase += k * dt * Math.PI * 2 / SEGUNDOS_POR_VAIVEN;
            var meta = Math.sin(fase) * GIRO_MAX * 0.6 + scr;
            rotY += (meta - rotY) * (1 - Math.exp(-dt * 1.6 * k));
          }
        } else rampa = 0;
        var r = cont.getBoundingClientRect();
        var p = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight + r.height)));
        scr = (p - 0.5) * 0.9;                                          /* ±26° según dónde esté en pantalla */

        var tx = 0, ty = 0;
        if (!drag && now - aim.t < 4000) { tx = aim.y * 0.22; ty = aim.x * 0.3; }
        var f = 1 - Math.exp(-dt * 3);
        tilt.x += (tx - tilt.x) * f; tilt.y += (ty - tilt.y) * f;
        var ry = rotY + tilt.y, rx = rotX + tilt.x;
        group.rotation.set(rx, ry, 0, 'YXZ');

        destellos.forEach(function (d) {
          var cara = Math.max(0, Math.cos(ry) * d.lado);
          var destello = Math.pow(Math.max(0, Math.cos(ry * 3 + rx * 2 + d.fase)), 14);
          var titila = 0.12 * (0.5 + 0.5 * Math.sin(now / 1000 * 2.1 + d.fase * 3));
          d.s.material.opacity = cara * Math.min(1, 0.06 + titila * 0.7 + destello * 0.85);
        });

        renderer.render(scene, camera);
        raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
      };
      var activar = function () { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
      var io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) activar(); }, { rootMargin: '80px 0px' });
      io.observe(cont);
      document.addEventListener('visibilitychange', activar);

      /* Primer cuadro dibujado: recién ahí la imagen fija cede su lugar al 3D */
      cont.appendChild(canvas);
      var ro = new ResizeObserver(resize); ro.observe(canvas);
      resize();
      renderer.render(scene, camera);
      canvas.style.visibility = '';
      cont.classList.add('es-3d');
      visible = true; activar();

      return {
        destruir: function () {
          visible = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); removeEventListener('pointermove', onMove);
          document.removeEventListener('visibilitychange', activar); cont.classList.remove('es-3d'); canvas.remove(); renderer.dispose();
        },
        girar: function (gy, gx) { rotY = gy; rotX = gx || 0; }   /* solo para pruebas */
      };
    });
  };
})();
