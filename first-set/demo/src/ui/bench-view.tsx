import { useEffect, useRef, useState, type PointerEvent } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BenchPart } from "../engine/scenario";
import { Equipment, Icon } from "./graphics";

const clips = ["RaiseBackrest", "RaiseSeat", "PullBackrestPin", "ReleaseSeatLatch"] as const;
export type BenchClip = typeof clips[number];
export type BenchPose = Record<BenchClip, number>;
export type BenchGesture = {
  target: string;
  label: string;
  clip?: BenchClip;
  onFinish: () => void;
};

type Props = { pose: BenchPose; part?: BenchPart; gesture: BenchGesture | null };
type Point = { x: number; y: number };

function disposeModel(model: THREE.Object3D) {
  const materials = new Set<THREE.MeshStandardMaterial>();
  const geometries = new Set<THREE.BufferGeometry>();
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    const options = Array.isArray(node.material) ? node.material : [node.material];
    options.forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  const textures = new Set<THREE.Texture>();
  materials.forEach((material) => {
    for (const texture of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap]) {
      if (texture) textures.add(texture);
    }
    material.dispose();
  });
  textures.forEach((texture) => {
    if (texture.image instanceof ImageBitmap) texture.image.close();
    texture.dispose();
  });
}

function createViewer(
  host: HTMLDivElement,
  marker: () => HTMLButtonElement | null,
  props: () => Props,
  setStatus: (status: "ready" | "failed") => void,
) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 20);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minZoom = .76;
  controls.maxZoom = 2.25;
  controls.rotateSpeed = .72;
  controls.minPolarAngle = .26;
  controls.maxPolarAngle = Math.PI * .53;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x858993, 2.06));
  const key = new THREE.DirectionalLight(0xfff6ea, 2.65);
  key.position.set(.2, 3.4, 2.5);
  const rim = new THREE.DirectionalLight(0xd6e5ff, 2.05);
  rim.position.set(-1.2, 2.1, -2);
  const fill = new THREE.DirectionalLight(0xf8f5f1, .9);
  fill.position.set(2, .8, .5);
  scene.add(key, rim, fill);

  // Soft contact shadow on the floor, kept lightweight for older phones.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  const context = shadowCanvas.getContext("2d")!;
  const shade = context.createRadialGradient(32, 32, 2, 32, 32, 32);
  shade.addColorStop(0, "rgba(7, 10, 15, .84)");
  shade.addColorStop(.65, "rgba(7, 10, 15, .38)");
  shade.addColorStop(1, "rgba(7, 10, 15, 0)");
  context.fillStyle = shade;
  context.fillRect(0, 0, 64, 64);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.67, .83), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -.002;
  scene.add(shadow);

  let model: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let closed = false;
  let frame = 0;
  let width = 1;
  let height = 1;
  let preview: { clip: BenchClip; fraction: number } | null = null;
  let lastTime = 0;
  let direction: Point = { x: 0, y: -1 };
  let focus = props().part;
  const displayed = { ...props().pose };
  const actions = new Map<BenchClip, THREE.AnimationAction>();
  const targets = new Map<string, THREE.Object3D>();
  const world = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function schedule() {
    if (!closed && !frame) frame = requestAnimationFrame(draw);
  }

  function resetView() {
    const part = props().part;
    const target = part === "seat"
      ? new THREE.Vector3(.04, .40, 0)
      : new THREE.Vector3(-.03, part || props().pose.RaiseBackrest ? .40 : .24, 0);
    const offset = part === "seat"
      ? new THREE.Vector3(1.20, .52, 2.04)
      : new THREE.Vector3(-.52, 1.02, 2.45);
    controls.target.copy(target);
    camera.position.copy(target).add(offset);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
    schedule();
  }

  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    const aspect = width / height;
    const viewWidth = Math.max(1.74, aspect * 1.04);
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewWidth / aspect / 2;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    schedule();
  }

  function applyClip(clip: BenchClip, fraction: number) {
    const action = actions.get(clip);
    if (action) action.time = action.getClip().duration * fraction;
  }

  const screenPoint = (target: THREE.Object3D) => target.getWorldPosition(new THREE.Vector3()).project(camera);

  function updateMarker() {
    const button = marker();
    const gesture = props().gesture;
    const target = gesture ? targets.get(gesture.target) : undefined;
    if (!button || !target || !gesture || !model || !mixer) return;
    const projected = screenPoint(target);
    const x = (projected.x + 1) * width / 2;
    const y = (1 - projected.y) * height / 2;

    target.getWorldPosition(world);
    raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
    const distance = raycaster.ray.origin.distanceTo(world);
    const obstruction = raycaster.intersectObject(model, true)[0]?.distance ?? Infinity;
    const isDragging = button.hasPointerCapture(Number(button.dataset.pointer));
    const visible = isDragging || (x > 23 && x < width - 23 && y > 23 && y < height - 23 && distance - obstruction < .072);
    button.style.visibility = visible ? "visible" : "hidden";
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;

    if (gesture.clip) {
      const clip = gesture.clip;
      applyClip(clip, 0);
      mixer.update(0);
      const start = screenPoint(target);
      applyClip(clip, 1);
      mixer.update(0);
      const end = screenPoint(target);
      applyClip(clip, preview?.clip === clip ? preview.fraction : displayed[clip]);
      mixer.update(0);
      const vector = new THREE.Vector2((end.x - start.x) * width, (start.y - end.y) * height);
      direction = vector.length() > 3 ? vector.normalize() : { x: 0, y: -1 };
    } else {
      direction = { x: 0, y: -1 };
    }
    button.style.setProperty("--gesture-angle", `${Math.atan2(direction.y, direction.x)}rad`);
  }

  function draw(time: number) {
    frame = 0;
    const elapsed = Math.min(34, time - (lastTime || time - 16));
    lastTime = time;
    const current = props();
    let moving = false;
    for (const clip of clips) {
      const dragPose = preview?.clip === clip ? preview : null;
      const wanted = dragPose?.fraction ?? current.pose[clip];
      if (dragPose || reducedMotion.matches || Math.abs(wanted - displayed[clip]) < .004) {
        displayed[clip] = wanted;
      } else {
        displayed[clip] += (wanted - displayed[clip]) * (1 - Math.exp(-elapsed / 52));
        moving = true;
      }
      applyClip(clip, displayed[clip]);
    }
    mixer?.update(0);
    camera.updateMatrixWorld();
    updateMarker();
    renderer.render(scene, camera);
    if (moving) schedule();
  }

  function fail() {
    if (!closed) setStatus("failed");
  }
  renderer.domElement.addEventListener("webglcontextlost", fail);
  controls.addEventListener("change", schedule);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resetView();
  resize();

  new GLTFLoader().load(`${import.meta.env.BASE_URL}art/bench.glb`, (gltf) => {
    if (closed) {
      disposeModel(gltf.scene);
      return;
    }
    model = gltf.scene;
    mixer = new THREE.AnimationMixer(model);
    const requiredTargets = ["BackrestPinTarget", "SeatLatchTarget", "BackrestCushionTarget", "SeatCushionTarget"];
    for (const name of requiredTargets) {
      const target = model.getObjectByName(name);
      if (target) targets.set(name, target);
    }
    for (const name of clips) {
      const clip = THREE.AnimationClip.findByName(gltf.animations, name);
      if (!clip) continue;
      const action = mixer.clipAction(clip).play();
      action.paused = true;
      actions.set(name, action);
    }
    if (actions.size !== clips.length || targets.size !== requiredTargets.length) {
      fail();
      return;
    }
    scene.add(model);
    setStatus("ready");
    schedule();
  }, undefined, fail);

  return {
    sync() {
      if (focus !== props().part) {
        focus = props().part;
        resetView();
      }
      schedule();
    },
    resetView,
    direction: () => direction,
    preview(clip?: BenchClip, fraction = 0) {
      preview = clip ? { clip, fraction } : null;
      schedule();
    },
    dispose() {
      closed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", fail);
      if (model) {
        mixer?.stopAllAction();
        mixer?.uncacheRoot(model);
        disposeModel(model);
      }
      shadow.geometry.dispose();
      shadowMaterial.dispose();
      shadowTexture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

type Drag = { pointer: number; start: Point; direction: Point; travel: number; total: number };

export default function BenchView(props: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const latest = useRef(props);
  const viewer = useRef<ReturnType<typeof createViewer> | null>(null);
  const drag = useRef<Drag | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const { gesture } = props;

  useEffect(() => {
    if (!surface.current) return;
    let instance: ReturnType<typeof createViewer>;
    try {
      instance = createViewer(surface.current, () => button.current, () => latest.current, setStatus);
      viewer.current = instance;
    } catch {
      setStatus("failed");
      return;
    }
    return () => {
      instance.dispose();
      viewer.current = null;
    };
  }, []);

  useEffect(() => {
    latest.current = props;
    viewer.current?.sync();
  }, [props, status]);

  function start(event: PointerEvent<HTMLButtonElement>) {
    if (!gesture || !viewer.current || !event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.pointer = String(event.pointerId);
    const release = gesture.clip === "PullBackrestPin" || gesture.clip === "ReleaseSeatLatch";
    drag.current = {
      pointer: event.pointerId, start: { x: event.clientX, y: event.clientY },
      direction: viewer.current.direction(), travel: 0, total: release ? 27 : 48,
    };
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId || !gesture) return;
    const distance = (event.clientX - active.start.x) * active.direction.x
      + (event.clientY - active.start.y) * active.direction.y;
    active.travel = Math.max(0, Math.min(1, distance / active.total));
    viewer.current?.preview(gesture.clip, active.travel);
  }

  function finish(event: PointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    drag.current = null;
    delete event.currentTarget.dataset.pointer;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    viewer.current?.preview();
    if (!cancelled && active.travel >= .82) gesture?.onFinish();
  }

  return (
    <div className="bench-view" data-model={status} aria-label="Трёхмерная скамья">
      <div className="bench-canvas" ref={surface} hidden={status === "failed"} />
      {status !== "ready" && (
        <div className="bench-view-placeholder">
          <Equipment name="bench" alt="Регулируемая скамья" />
          <p role="status">{status === "failed" ? "3D-модель недоступна. Шаги можно выполнить кнопками." : "Загружается 3D-модель…"}</p>
        </div>
      )}
      {status === "ready" && (
        <>
          <button type="button" className="bench-camera-button" aria-label="Вернуть исходный ракурс"
            title="Вернуть исходный ракурс" onClick={() => viewer.current?.resetView()}><Icon name="rotate" size={20} /></button>
          <p className="bench-camera-help">Поворот перетаскиванием · масштаб щипком или колёсиком</p>
          {gesture && (
            <button type="button" className="bench-marker" key={gesture.label} ref={button}
              tabIndex={-1} aria-label={`На модели: ${gesture.label}`}
              onPointerDown={start} onPointerMove={move} onPointerUp={(event) => finish(event, false)}
              onPointerCancel={(event) => finish(event, true)} onLostPointerCapture={(event) => finish(event, true)}
              onClick={(event) => { if (event.detail === 0) gesture.onFinish(); }}>
              <Icon name="arrow" size={25} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
