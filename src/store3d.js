// 카페 유형 화면의 3D 매장 미리보기. 바닥·벽·카운터는 아트 바이블 색으로 직접 그리고,
// 손이 많이 가는 소품은 Meshy로 만든 assets/models/*.glb 를 쓴다. three.js는 이 화면에서만 불러온다.
// 게임 계산과는 무관한 보여 주기용 배치다: 평수·좌석 수·베이커리 여부만 게임 설정을 따른다.

const PYEONG_M2 = 3.3058;
const COUNTER_DEPTH = 0.7;
const COUNTER_HEIGHT = 0.95;

// 소품의 실제 크기(m) — Meshy 모델은 크기가 제각각이라 가장 긴 변을 이 값에 맞춘다
const PROP_SIZE = {
  espresso_machine: 0.75, grinder: 0.55, pos: 0.32, pastry_case: 1.2, deck_oven: 1.3,
  table_two: 1.5, bar_stool: 0.75, plant: 1.3, sign: 0.9, pendant_lamp: 0.55,
};
const FOOTPRINT = { table_two: 1.9, bar_stool: 0.6 };   // 의자까지 포함한 가로 폭(m)
const TABLE_ROW = 1.6;

// 좌석 수를 2인석과 창가 바 스툴로 나눈다. 모델 의자 수가 확인된 2인석만 쓴다
// (Meshy 4인석은 두 번 만들어도 의자가 2개·3개라 뺐다)
export function seatPlan(seats, small) {
  const two = Math.floor(seats / (small ? 4 : 3));
  return { two, stools: seats - two * 2 };
}

// 게임 매장 설정 → 소품 배치. x는 좌우, z는 앞(+)·뒤(−), 바닥 가운데가 원점
export function storeLayout(format) {
  const area = format.pyeong * PYEONG_M2;
  const width = Math.sqrt(area * 1.3);
  const depth = area / width;
  const back = -depth / 2;
  const kitchen = format.bakes ? depth * 0.35 : 0;   // 베이커리는 평수의 일부가 주방
  const counterZ = back + kitchen + COUNTER_DEPTH / 2;
  const props = [];
  const onCounter = (name, x) => props.push({ name, x, y: COUNTER_HEIGHT, z: counterZ });
  onCounter("espresso_machine", -width * 0.18);
  onCounter("grinder", -width * 0.18 - 0.6);
  onCounter("pos", width * 0.08);
  if (format.id !== "solo_cafe") props.push({ name: "pastry_case", x: width / 2 - 0.9, y: 0, z: counterZ });
  if (format.bakes) props.push({ name: "deck_oven", x: -width * 0.25, y: 0, z: back + 0.5 }, { name: "deck_oven", x: width * 0.2, y: 0, z: back + 0.5 });

  // 손님 자리: 카운터 앞부터 출입문 쪽까지 격자로 채우고, 남는 좌석은 창가 바 스툴
  const plan = seatPlan(format.seats, format.id === "solo_cafe");
  const seatFront = depth / 2 - 1.0;
  const seatBack = counterZ + COUNTER_DEPTH / 2 + 1.4;   // 카운터 앞 주문 줄 자리
  const columns = Math.max(1, Math.floor((width - 0.6) / FOOTPRINT.table_two));
  const placedTables = Array.from({ length: plan.two }, (_, i) => {
    const column = i % columns, row = Math.floor(i / columns);
    const x = -width / 2 + 0.3 + (column + 0.5) * ((width - 0.6) / columns);
    const z = Math.min(seatFront, seatBack + row * TABLE_ROW);
    return { name: "table_two", x, y: 0, z, seats: 2 };
  });
  props.push(...placedTables);
  for (let i = 0; i < plan.stools; i++) {
    props.push({ name: "bar_stool", x: -width / 2 + 0.6 + i * FOOTPRINT.bar_stool, y: 0, z: depth / 2 - 0.35, seats: 1 });
  }
  props.push({ name: "plant", x: width / 2 - 0.4, y: 0, z: depth / 2 - 0.4 });
  props.push({ name: "sign", x: width / 2 + 0.6, y: 0, z: depth / 2 + 0.5 });
  for (const table of placedTables.slice(0, 3)) props.push({ name: "pendant_lamp", x: table.x, y: 2.1, z: table.z, hanging: true });
  return { width, depth, counterZ, kitchen, props };
}

const AUTO_ROTATE = 0.6;
const modelCache = new Map();
const loadModel = (loader, name) => {
  if (!modelCache.has(name)) {
    // 실패한 요청은 캐시에서 지워 다음 미리보기 때 다시 받는다
    modelCache.set(name, loader.loadAsync(`./assets/models/${name}.glb`).then((gltf) => gltf.scene, (error) => { modelCache.delete(name); throw error; }));
  }
  return modelCache.get(name);
};

// signal이 중단되면(카드를 다시 고르거나 화면을 떠나면) WebGL을 만들기 전에 멈춘다.
// WebGL을 못 쓰면 예외를 던지고, main.js가 미리보기 자리를 지운다.
export async function mountStore3d(container, { format, district, signal }) {
  const THREE = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
  const layout = storeLayout(format);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#241C17");

  // 따뜻한 오후 중립광(아트 바이블 6장) + 부드러운 그림자
  scene.add(new THREE.HemisphereLight("#F0E4CF", "#6D4A36", 1.6));
  const sun = new THREE.DirectionalLight("#FFE9C7", 2.2);
  sun.position.set(-4, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  scene.add(sun);

  const box = (w, h, d, color, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    mesh.position.set(x, y + h / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = h > 0.2;
    scene.add(mesh);
  };
  const { width, depth, counterZ } = layout;
  const wall = district === "seongsu" ? "#8A4A38" : "#E8D5B5";
  box(width, 0.1, depth, "#8A6244", 0, -0.1, 0);                                  // 나무 바닥
  box(width, 2.8, 0.12, wall, 0, 0, -depth / 2 - 0.06);                            // 뒷벽
  box(0.12, 2.8, depth, "#EFE3CB", -width / 2 - 0.06, 0, 0);                       // 왼쪽 벽
  box(width * 0.7, COUNTER_HEIGHT - 0.05, COUNTER_DEPTH, "#6D4A36", -width * 0.15, 0, counterZ);   // 카운터 몸통(오른쪽 끝은 쇼케이스 자리)
  box(width * 0.72, 0.05, COUNTER_DEPTH + 0.06, "#E8D5B5", -width * 0.15, COUNTER_HEIGHT - 0.05, counterZ); // 상판
  if (layout.kitchen) box(width, 0.02, layout.kitchen, "#D7DCD4", 0, 0.001, -depth / 2 + layout.kitchen / 2); // 주방 타일

  const loader = new GLTFLoader();
  await Promise.all(layout.props.map(async (prop) => {
    let source;
    try { source = await loadModel(loader, prop.name); } catch { return; } // 모델이 없으면 그 소품만 빠진다
    const object = source.clone(true);
    const bounds = new THREE.Box3().setFromObject(object);
    const dims = bounds.getSize(new THREE.Vector3());
    const scale = PROP_SIZE[prop.name] / Math.max(dims.x, dims.y, dims.z);
    object.scale.setScalar(scale);
    const center = bounds.getCenter(new THREE.Vector3());
    object.position.set(prop.x - center.x * scale, prop.hanging ? prop.y : prop.y - bounds.min.y * scale, prop.z - center.z * scale);
    object.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    scene.add(object);
  }));
  if (signal?.aborted) return () => {};

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.replaceChildren(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const reach = Math.max(width, depth, 6.5);   // 작은 매장도 벽이 화면 밖으로 잘리지 않게
  camera.position.set(reach * 0.68, reach * 0.8, reach * 0.95);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.6, 0);
  // 휠·세로 스와이프는 페이지 스크롤에 양보한다(확대 없음)
  Object.assign(controls, {
    enableDamping: true, enablePan: false, enableZoom: false,
    minPolarAngle: 0.5, maxPolarAngle: 1.2, minAzimuthAngle: -0.2, maxAzimuthAngle: 1.4,
    autoRotate: !matchMedia("(prefers-reduced-motion: reduce)").matches, autoRotateSpeed: AUTO_ROTATE,
  });
  renderer.domElement.style.touchAction = "pan-y";
  // 터치 기기에서는 끌어서 돌리기를 끄고 자동 회전만 보여 준다
  if (matchMedia("(pointer: coarse)").matches) controls.enableRotate = false;
  else renderer.domElement.addEventListener("pointerdown", () => { controls.autoRotate = false; }, { once: true });

  let frame = 0;
  let last = performance.now();
  const tick = (now = performance.now()) => {
    const [w, h] = [container.clientWidth, container.clientHeight];
    const ratio = renderer.getPixelRatio();
    if (w && h && (renderer.domElement.width !== Math.floor(w * ratio) || renderer.domElement.height !== Math.floor(h * ratio))) {
      renderer.setSize(w, h, false);   // 크기는 CSS가 정하고 그리기 해상도만 맞춘다
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    // 자동 회전은 돌 수 있는 범위 끝에서 방향을 바꾼다
    const angle = controls.getAzimuthalAngle();
    if (angle <= controls.minAzimuthAngle + 0.01) controls.autoRotateSpeed = -AUTO_ROTATE;
    else if (angle >= controls.maxAzimuthAngle - 0.01) controls.autoRotateSpeed = AUTO_ROTATE;
    controls.update(Math.min(0.1, (now - last) / 1000));
    last = now;
    if (w && h) renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(frame);
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
