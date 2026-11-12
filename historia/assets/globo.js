// Globo nocturno de Miselia: un planeta enorme que sale por abajo; Colombia y Suiza se ven a la vez en el horizonte.
// El marco local del globo es el del arco (Cali y Zürich sobre el "ecuador", a +-a). La textura se lee con la longitud
// ampliada k veces, porque los 84 grados reales entre las dos ciudades no caben en un casquete tan plano (se dice en las notas).
// API: progreso(entrada, rotacion, arco, hazCali, hazZurich) · activar · marcadores · posFinal · punto · exportar
window.Globo = function (THREE, canvas, texUrl) {
  var R = Math.PI / 180, FOV = 14;
  var CALI = [3.45, -76.53], ZUR = [47.37, 8.54];
  var CAJA = [-110 * R, 70 * R, -15 * R, 65 * R]; // recorte de la textura: lon0, lon1, lat0, lat1
  var A1 = [0.13, 0.91], A2 = [0.77, 0.82]; // dónde caen Colombia y Suiza en la pantalla (boceto de Ian)
  var ARCO_ALTO = 0.09;
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  var PR = function () { return Math.min(window.devicePixelRatio || 1, 1.75); };
  renderer.setPixelRatio(PR());
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 80);
  var group = new THREE.Group(); scene.add(group);
  var camPos = new THREE.Vector3(0, 0, 3), TH = { value: 1.2 };

  // ---- geografía real -> marco del arco ----
  var geo = function (lat, lon) {
    var phi = (90 - lat) * R, th = (lon + 180) * R;
    return new THREE.Vector3(-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
  };
  var gC = geo(CALI[0], CALI[1]), gZ = geo(ZUR[0], ZUR[1]);
  var ANG_GEO = gC.angleTo(gZ);
  var Mg = gC.clone().add(gZ).normalize();
  var Tg = gZ.clone().sub(gC); Tg.sub(Mg.clone().multiplyScalar(Tg.dot(Mg))).normalize();
  var Eg = Mg.clone().cross(Tg);
  var Fm = new THREE.Matrix3().set(Tg.x, Eg.x, Mg.x, Tg.y, Eg.y, Mg.y, Tg.z, Eg.z, Mg.z); // columnas: T, E, M

  // ---- encuadre: el horizonte pasa por la curva de Ian (68 % de alto al centro, 97 % a la izquierda, 95 % a la derecha) ----
  var cuadro = function (w, h) {
    var f = (h / 2) / Math.tan(FOV / 2 * R), dx = 0.5 * w, dr = 0.29 * h, rho = (dx * dx + dr * dr) / (2 * dr);
    return { w: w, h: h, f: f, cx: 0.5 * w, cy: 0.68 * h + rho, d: Math.sqrt(1 + (f / rho) * (f / rho)) };
  };
  var rayo = function (ax, ay, K) { // punto de la esfera (de radio 1) que se ve en un píxel
    var v = new THREE.Vector3((ax - K.cx) / K.f, (K.cy - ay) / K.f, -1).normalize(), c = new THREE.Vector3(0, 0, K.d);
    var b = c.dot(v), disc = b * b - (c.lengthSq() - 1); if (disc < 0) disc = 0;
    return c.add(v.multiplyScalar(-b - Math.sqrt(disc))).normalize();
  };
  var base = function (u, v) {
    var z = u.clone().add(v).normalize(), x = v.clone().sub(u).normalize(), y = z.clone().cross(x);
    return new THREE.Matrix4().makeBasis(x, y, z);
  };

  var K = cuadro(1920, 1080), rise = 0, qBase = new THREE.Quaternion(), K_ = { value: 2 };
  var pCali = new THREE.Vector3(), pZur = new THREE.Vector3(), curva = null, seg = 220, rad = 6, idxPorSeg = rad * 6;

  // ---- planeta ----
  var listo = false;
  var tex = new THREE.TextureLoader().load(texUrl, function () { listo = true; });
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  var U = { cam: { value: camPos }, th: TH };
  var sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, cam: U.cam, box: { value: new THREE.Vector4(CAJA[0], CAJA[1], CAJA[2], CAJA[3]) }, F: { value: Fm }, k: K_ },
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vP=position; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: 'uniform sampler2D map; uniform vec3 cam; uniform vec4 box; uniform mat3 F; uniform float k; varying vec3 vP; varying vec3 vN; varying vec3 vW;' +
      'void main(){ vec3 p=normalize(vP); float lo1=atan(p.x,p.z); float la1=asin(clamp(p.y,-1.0,1.0)); float loG=lo1*k;' +
      ' vec3 pg=vec3(sin(loG)*cos(la1),sin(la1),cos(loG)*cos(la1)); vec3 q=F*pg;' +
      ' float lat=asin(clamp(q.y,-1.0,1.0)); float th=atan(q.z,-q.x); if(th<0.0) th+=6.2831853; float lon=th-3.1415927;' +
      ' vec2 uv=vec2((lon-box.x)/(box.y-box.x),(lat-box.z)/(box.w-box.z));' +
      ' float ins=smoothstep(0.0,0.03,uv.x)*smoothstep(0.0,0.03,1.0-uv.x)*smoothstep(0.0,0.03,uv.y)*smoothstep(0.0,0.03,1.0-uv.y);' +
      ' vec3 t=texture2D(map,clamp(uv,0.0,1.0)).rgb*ins; vec3 N=normalize(vN); vec3 V=normalize(cam-vW); float nv=max(dot(N,V),0.0);' +
      ' float m=clamp(min(t.r,t.g)*3.0,0.0,1.0); vec3 base=t*vec3(0.5,0.8,1.05)*0.8+vec3(0.004,0.011,0.017);' +
      ' vec3 gold=vec3(1.0,0.77,0.4)*m*1.25; float f=pow(1.0-nv,6.0);' +
      ' vec3 rim=mix(vec3(0.5,0.72,1.0),vec3(1.0,0.8,0.5),smoothstep(0.62,1.0,f))*f*0.75;' +
      ' gl_FragColor=vec4(base+gold+rim,1.0); }'
  }));
  group.add(sphere);

  // atmósfera: una línea fina y brillante en el borde (azul pálido que pasa a dorado) y un halo muy suave
  var capa = function (Rs, k, pw) {
    return new THREE.Mesh(new THREE.SphereGeometry(Rs, 96, 64), new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { cam: U.cam, Rs: { value: Rs }, k: { value: k }, pw: { value: pw } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: 'uniform vec3 cam; uniform float Rs; uniform float k; uniform float pw; varying vec3 vW;' +
        'void main(){ vec3 v=normalize(vW-cam); float b=length(cross(cam,v)); float h=clamp((b-1.0)/(Rs-1.0),0.0,1.0);' +
        ' float i=pow(1.0-h,pw)*k; vec3 c=mix(vec3(0.6,0.8,1.0),vec3(1.0,0.8,0.48),smoothstep(0.1,0.95,h)); gl_FragColor=vec4(c,i); }'
    }));
  };
  scene.add(capa(1.0045, 1.5, 1.35)); scene.add(capa(1.06, 0.3, 2.6));

  // ---- arco Cali -> Zürich: fino, con núcleo casi blanco y glow; se desvanece al pasar el horizonte ----
  var FADE = 'uniform vec3 cam; uniform float th; float vis(vec3 w){ float a=acos(clamp(dot(normalize(w),normalize(cam)),-1.0,1.0)); return 1.0-smoothstep(th-0.13,th+0.07,a); }';
  var matArco = function (col, op, aditivo) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { cam: U.cam, th: U.th, col: { value: new THREE.Color(col) }, op: { value: op } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: FADE + ' uniform vec3 col; uniform float op; varying vec3 vW; void main(){ gl_FragColor=vec4(col,op*vis(vW)); }'
    });
  };
  var capas = [[1.0, 0xfff4d2, 1, false], [3.2, 0xf4d08a, 0.3, true], [8, 0xe5b862, 0.12, true], [18, 0xd9a64e, 0.05, true]];
  var tubos = capas.map(function (k) { var m = new THREE.Mesh(new THREE.BufferGeometry(), matArco(k[1], k[2], k[3])); m.renderOrder = 2; group.add(m); return m; });
  var radios = function (f, D0) { tubos.forEach(function (m, j) { m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(curva, seg, capas[j][0] * D0 / f, rad, false); }); };

  // luz que viaja por el arco
  var c = document.createElement('canvas'); c.width = c.height = 64;
  var g2 = c.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.25, 'rgba(255,214,130,.65)'); gr.addColorStop(1, 'rgba(255,200,100,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
  var luzMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  var luz = new THREE.Sprite(luzMat); luz.scale.set(0.03, 0.03, 1); group.add(luz);

  // haces de luz verticales muy tenues sobre Cali y Zürich
  var haz = function (defs) {
    var g = new THREE.Group();
    var lista = defs.map(function (d) {
      var geom = new THREE.CylinderGeometry(0.0003, 0.0006, 1, 5, 1, true); geom.translate(0, 0.5, 0);
      var m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { cam: U.cam, th: U.th, op: { value: 0 } },
        vertexShader: 'varying float vH; varying vec3 vO; void main(){ vH=position.y; vO=(modelMatrix*vec4(0.0,0.0,0.0,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); }',
        fragmentShader: FADE + ' uniform float op; varying float vH; varying vec3 vO; void main(){ gl_FragColor=vec4(vec3(1.0,0.9,0.66),op*pow(1.0-vH,1.5)*vis(vO)); }'
      });
      var me = new THREE.Mesh(geom, m); me.userData = { len: d[1], off: d[0] }; me.scale.set(1, 0.001, 1); g.add(me); return me;
    });
    group.add(g); return lista;
  };
  var hCali = haz([[0, 0.07], [0.006, 0.045], [-0.005, 0.055], [0.011, 0.03], [-0.01, 0.038]]);
  var hZur = haz([[0, 0.07], [0.006, 0.045], [-0.005, 0.055], [0.011, 0.03], [-0.01, 0.038]]);
  var Yv = new THREE.Vector3(0, 1, 0);
  var ponerHaz = function (lista, p) {
    var ej = new THREE.Vector3().crossVectors(p, Yv).normalize();
    lista.forEach(function (m) { var q = p.clone().add(ej.clone().multiplyScalar(m.userData.off)).normalize(); m.position.copy(q); m.quaternion.setFromUnitVectors(Yv, q); });
  };
  var verHaz = function (lista, v) { lista.forEach(function (m) { m.scale.y = Math.max(0.001, v * m.userData.len); m.material.uniforms.op.value = 0.3 * v; m.visible = v > 0.01; }); };

  // ---- (re)calcular todo lo que depende del encuadre ----
  var recalcular = function () {
    var Qc = rayo(A1[0] * K.w, A1[1] * K.h, K), Qz = rayo(A2[0] * K.w, A2[1] * K.h, K);
    var angS = Qc.angleTo(Qz), a = angS / 2;
    K_.value = ANG_GEO / angS;
    pCali.set(Math.sin(-a), 0, Math.cos(-a)); pZur.set(Math.sin(a), 0, Math.cos(a));
    qBase.setFromRotationMatrix(base(Qc, Qz));
    var pts = [], N = 160;
    for (var i = 0; i <= N; i++) {
      var t = i / N, lo = -a + t * 2 * a, el = ARCO_ALTO * Math.pow(Math.sin(Math.PI * t), 0.85) + 0.004;
      pts.push(new THREE.Vector3(Math.sin(lo), 0, Math.cos(lo)).multiplyScalar(1 + el));
    }
    curva = new THREE.CatmullRomCurve3(pts);
    ponerHaz(hCali, pCali); ponerHaz(hZur, pZur);
  };
  var vista = function (k, desplazo) {
    camera.aspect = k.w / k.h; camPos.set(0, 0, k.d); camera.position.copy(camPos); camera.lookAt(0, 0, 0);
    camera.setViewOffset(k.w, k.h, k.w / 2 - k.cx, k.h / 2 - k.cy - (desplazo || 0), k.w, k.h);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    TH.value = Math.acos(1 / k.d);
  };
  recalcular(); radios(K.f, K.d - 1);

  // ---- estado y bucle ----
  var P = { entry: 0, rot: 0, arc: 0, bc: 0, bz: 0 }, activo = false, raf = 0, w = 1, h = 1, t0 = performance.now();
  var ease = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  var qA = new THREE.Quaternion(), YAX = new THREE.Vector3(0, 1, 0);
  var aplicar = function (ent, now) {
    var amb = Math.sin(((now || performance.now()) - t0) / 9000) * 0.012; // el planeta gira apenas, como ambiente
    qA.setFromAxisAngle(YAX, amb + (1 - ease(ent)) * 0.5);
    group.quaternion.copy(qA).multiply(qBase);
    var r = (1 - ease(ent)) * 0.62 * K.h;
    if (Math.abs(r - rise) > 0.3) { rise = r; vista(K, rise); }
    group.updateMatrixWorld(true);
  };
  var opac = function (p) {
    var v = p.clone(); group.localToWorld(v); var a = Math.acos(Math.max(-1, Math.min(1, v.z / v.length())));
    return 1 - Math.max(0, Math.min(1, (a - (TH.value - 0.05)) / 0.25));
  };
  var frame = function (now) {
    aplicar(P.entry, now);
    var cnt = Math.floor(P.arc * seg) * idxPorSeg;
    tubos.forEach(function (m) { m.geometry.setDrawRange(0, cnt); m.visible = cnt > 0; });
    var pl = curva.getPoint(Math.max(0, Math.min(1, P.arc)));
    luz.visible = P.arc > 0.01; luz.position.copy(pl);
    var fin = P.arc >= 0.999, pul = 0.022 + (fin ? 0.009 : 0.004) * Math.sin((now - t0) / (fin ? 330 : 380)); luz.scale.set(pul, pul, 1);
    luzMat.opacity = Math.max(0, Math.min(1, opac(pl)));
    verHaz(hCali, P.bc); verHaz(hZur, P.bz);
    renderer.render(scene, camera);
    raf = activo ? requestAnimationFrame(frame) : 0;
  };
  var resize = function () {
    w = canvas.clientWidth || 1; h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    K = cuadro(w, h); recalcular(); vista(K, rise);
    radios(K.f, K.d - 1);
  };
  new ResizeObserver(resize).observe(canvas); resize();

  var proyectar = function (p) {
    var v = p.clone(); group.updateMatrixWorld(true); v = group.localToWorld(v);
    var a = Math.acos(Math.max(-1, Math.min(1, v.z / v.length())));
    var n = v.clone().project(camera);
    return { x: (n.x * 0.5 + 0.5) * w, y: (-n.y * 0.5 + 0.5) * h, vis: a < TH.value - 0.04 };
  };
  return {
    progreso: function (entry, rot, arc, bc, bz) { P.entry = entry; P.arc = arc; P.bc = bc || 0; P.bz = bz || 0; },
    activar: function (v) { activo = !!v; if (activo && !raf) raf = requestAnimationFrame(frame); },
    marcadores: function () { aplicar(P.entry); return { cali: proyectar(pCali), zur: proyectar(pZur) }; },
    posFinal: function () { var e0 = P.entry, r0 = rise; rise = 0; vista(K, 0); aplicar(1); var r = proyectar(pZur); rise = 1e9; aplicar(e0); return r; },
    punto: function (t) { aplicar(P.entry); return proyectar(curva.getPoint(Math.max(0, Math.min(1, t)))); },
    // imagen fija para modo liviano / móvil / PDF: la misma composición, con el arco entero y los dos puntos
    exportar: function (ancho, alto) {
      var ow = w, oh = h, oq = group.quaternion.clone();
      renderer.setPixelRatio(1); renderer.setSize(ancho, alto, false); w = ancho; h = alto; K = cuadro(ancho, alto); rise = 0;
      recalcular(); vista(K, 0); radios(K.f, K.d - 1);
      group.quaternion.copy(qBase); group.updateMatrixWorld(true);
      tubos.forEach(function (m) { m.geometry.setDrawRange(0, seg * idxPorSeg); m.visible = true; }); luz.visible = false;
      verHaz(hCali, 1); verHaz(hZur, 1);
      renderer.render(scene, camera);
      var url = canvas.toDataURL('image/png'), pz = proyectar(pZur), pc = proyectar(pCali), apice = proyectar(curva.getPoint(0.5));
      w = ow; h = oh; K = cuadro(ow, oh); rise = 1e9;
      renderer.setPixelRatio(PR()); renderer.setSize(ow, oh, false); recalcular(); vista(K, 0); radios(K.f, K.d - 1); group.quaternion.copy(oq);
      return { url: url, zur: pz, cali: pc, apice: apice, w: ancho, h: alto };
    }
  };
};
