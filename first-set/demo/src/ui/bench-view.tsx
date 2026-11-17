import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { benchNotches, benchParts, type BenchNotch, type BenchPart } from "../engine/scenario";
import { Equipment, Icon } from "./graphics";

const clips = ["RaiseBackrest", "RaiseSeat", "PullBackrestPin", "ReleaseSeatLatch"] as const;
export type BenchClip = typeof clips[number];
export type BenchPose = Record<BenchClip, number>;
type Control = "latch" | "cushion";
type Props = {
  pose: BenchPose;
  part: BenchPart;
  notch: BenchNotch;
  target?: BenchNotch;
  paused: boolean;
  onPreview: (notch?: BenchNotch) => void;
  onAdjust: (notch: BenchNotch) => void;
};
type Point = { x: number; y: number };

const controlsByPart = {
  backrest: {
    latch: { target: "BackrestPinTarget", label: "Отвести и удерживать штифт", clip: "PullBackrestPin" },
    cushion: { target: "BackrestCushionTarget", label: "Регулировать спинку", clip: "RaiseBackrest" },
  },
  seat: {
    latch: { target: "SeatLatchTarget", label: "Отвести и удерживать П-образный рычаг", clip: "ReleaseSeatLatch" },
    cushion: { target: "SeatCushionTarget", label: "Регулировать сиденье", clip: "RaiseSeat" },
  },
} as const;
const cushionNames = { backrest: "BackrestCushion", seat: "SeatCushion" } as const;

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
  marker: (control: Control) => HTMLButtonElement | null,
  guide: () => HTMLSpanElement | null,
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
  const ghostFill = new THREE.MeshBasicMaterial({ color: 0x00cec9, transparent: true, opacity: .24, depthWrite: false });
  const ghostEdge = new THREE.LineBasicMaterial({ color: 0x078687, transparent: true, opacity: .85, depthWrite: false });
  const ghosts = new Map<BenchPart, { cushion: THREE.Mesh; shape: THREE.Mesh; edge: THREE.EdgesGeometry }>();
  let closed = false;
  let frame = 0;
  let width = 1;
  let height = 1;
  let preview: Partial<BenchPose> = {};
  let lastTime = 0;
  const directions: Record<Control, Point> = { latch: { x: 1, y: 0 }, cushion: { x: 0, y: -1 } };
  let focus = props().part;
  const displayed = { ...props().pose };
  const actions = new Map<BenchClip, THREE.AnimationAction>();
  const targets = new Map<string, THREE.Object3D>();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function schedule() {
    if (!closed && !frame) frame = requestAnimationFrame(draw);
  }

  function resetView() {
    const part = props().part;
    const target = part === "seat"
      ? new THREE.Vector3(.04, .40, 0)
      : new THREE.Vector3(-.03, .40, 0);
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

  function updateMarkers() {
    if (!model || !mixer) return;
    const { part, target: goal } = props();
    const controls = controlsByPart[part];
    for (const { shape } of ghosts.values()) shape.visible = false;
    let latchPoint: Point | undefined;
    for (const kind of ["latch", "cushion"] as const) {
      const button = marker(kind);
      const { target: name, clip } = controls[kind];
      const target = targets.get(name);
      if (!button || !target) continue;
      const projected = screenPoint(target);
      let x = THREE.MathUtils.clamp((projected.x + 1) * width / 2, 23, width - 23);
      let y = THREE.MathUtils.clamp((1 - projected.y) * height / 2, 23, height - 23);
      if (kind === "latch") latchPoint = { x, y };
      if (latchPoint && kind === "cushion" && Math.hypot(x - latchPoint.x, y - latchPoint.y) < 52) {
        y = Math.max(23, latchPoint.y - 54);
      }
      button.style.visibility = "visible";
      button.style.left = x + "px";
      button.style.top = y + "px";

      applyClip(clip, 0);
      mixer.update(0);
      const start = screenPoint(target);
      applyClip(clip, 1);
      mixer.update(0);
      const end = screenPoint(target);
      const halo = kind === "cushion" ? guide() : null;
      if (halo && goal !== undefined) {
        applyClip(clip, goal / lastNotch);
        mixer.update(0);
        const aim = screenPoint(target);
        halo.style.left = THREE.MathUtils.clamp((aim.x + 1) * width / 2, 25, width - 25) + "px";
        halo.style.top = THREE.MathUtils.clamp((1 - aim.y) * height / 2, 25, height - 25) + "px";
        const ghost = ghosts.get(part);
        if (ghost && (preview[controls.latch.clip] ?? 0) >= .78) {
          ghost.cushion.updateWorldMatrix(true, false);
          ghost.shape.matrix.copy(ghost.cushion.matrixWorld);
          ghost.shape.matrixWorldNeedsUpdate = true;
          ghost.shape.visible = true;
        }
      }
      applyClip(clip, displayed[clip]);
      mixer.update(0);
      const vector = new THREE.Vector2((end.x - start.x) * width, (start.y - end.y) * height);
      if (vector.length() > 2) directions[kind] = vector.normalize();
      const { x: dx, y: dy } = directions[kind];
      button.style.setProperty("--gesture-angle", Math.atan2(dy, dx) + "rad");
    }
  }

  function draw(time: number) {
    frame = 0;
    const elapsed = Math.min(34, time - (lastTime || time - 16));
    lastTime = time;
    const current = props();
    let moving = false;
    for (const clip of clips) {
      const dragPose = preview[clip];
      const wanted = dragPose ?? current.pose[clip];
      if (dragPose !== undefined || reducedMotion.matches || Math.abs(wanted - displayed[clip]) < .004) {
        displayed[clip] = wanted;
      } else {
        displayed[clip] += (wanted - displayed[clip]) * (1 - Math.exp(-elapsed / 52));
        moving = true;
      }
      applyClip(clip, displayed[clip]);
    }
    mixer?.update(0);
    camera.updateMatrixWorld();
    updateMarkers();
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
    for (const part of benchParts) {
      const cushion = model.getObjectByName(cushionNames[part])?.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh);
      if (!cushion) continue;
      const shape = new THREE.Mesh(cushion.geometry, ghostFill);
      const edge = new THREE.EdgesGeometry(cushion.geometry, 16);
      shape.add(new THREE.LineSegments(edge, ghostEdge));
      shape.matrixAutoUpdate = false;
      shape.visible = false;
      scene.add(shape);
      ghosts.set(part, { cushion, shape, edge });
    }
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
    orbit(enabled: boolean) { controls.enabled = enabled; },
    direction: (control: Control) => directions[control],
    preview(pose: Partial<BenchPose> = {}) {
      preview = pose;
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
      for (const ghost of ghosts.values()) ghost.edge.dispose();
      ghostFill.dispose();
      ghostEdge.dispose();
      shadow.geometry.dispose();
      shadowMaterial.dispose();
      shadowTexture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}



type Drag = { id: number; origin: Point; direction: Point; from: number; extent: number };
type Manipulation = {
  latch: Drag | null;
  cushion: Drag | null;
  pull: number;
  angle?: number;
  keyboard: boolean;
};

function idle(): Manipulation {
  return { latch: null, cushion: null, pull: 0, keyboard: false };
}

const lastNotch = benchNotches.length - 1;

export default function BenchView(props: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const latch = useRef<HTMLButtonElement>(null);
  const cushion = useRef<HTMLButtonElement>(null);
  const goalMarker = useRef<HTMLSpanElement>(null);
  const latest = useRef(props);
  const viewer = useRef<ReturnType<typeof createViewer> | null>(null);
  const manipulation = useRef(idle());
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [unlocked, setUnlocked] = useState(false);
  const [aligned, setAligned] = useState(false);
  const exercise = controlsByPart[props.part];

  useEffect(() => {
    if (!surface.current) return;
    let instance: ReturnType<typeof createViewer>;
    try {
      instance = createViewer(surface.current, (control) => control === "latch" ? latch.current : cushion.current,
        () => goalMarker.current, () => latest.current, setStatus);
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

  useEffect(() => {
    function cancel() {
      manipulation.current = idle();
      viewer.current?.orbit(true);
      viewer.current?.preview();
      setUnlocked(false);
      setAligned(false);
      latest.current.onPreview(undefined);
    }
    cancel();
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, [props.part]);

  function updatePreview() {
    const active = manipulation.current;
    viewer.current?.preview({ [exercise.latch.clip]: active.pull, [exercise.cushion.clip]: active.angle });
    setUnlocked(active.pull >= .78);
    const notch = active.angle === undefined ? undefined : benchNotches[Math.round(active.angle * lastNotch)];
    setAligned(notch !== undefined && notch === props.target);
    props.onPreview(notch);
  }

  function relock(commit: boolean) {
    const active = manipulation.current;
    manipulation.current = idle();
    viewer.current?.orbit(true);
    viewer.current?.preview();
    setUnlocked(false);
    setAligned(false);
    props.onPreview(undefined);
    if (commit && active.pull >= .78 && active.angle !== undefined) {
      props.onAdjust(benchNotches[Math.round(active.angle * lastNotch)]);
    }
  }

  function startDrag(event: PointerEvent<HTMLElement>, control: Control) {
    if (status === "loading" || props.paused || event.button !== 0) return;
    const active = manipulation.current;
    if (active[control] || (control === "latch" ? active.keyboard : active.pull < .78)) return;
    viewer.current?.orbit(false);
    const button = event.currentTarget;
    button.setPointerCapture(event.pointerId);
    const scale = button.getBoundingClientRect().width / button.offsetWidth;
    active[control] = {
      id: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      direction: viewer.current?.direction(control) ?? (control === "latch" ? { x: 1, y: 0 } : { x: 0, y: -1 }),
      from: control === "latch" ? 0 : active.angle ?? props.notch / lastNotch,
      extent: (control === "latch" ? 27 : 87) * scale,
    };
  }

  function updateDrag(event: PointerEvent<HTMLElement>, control: Control) {
    const active = manipulation.current;
    const drag = active[control];
    if (!drag || drag.id !== event.pointerId) return;
    const distance = (event.clientX - drag.origin.x) * drag.direction.x
      + (event.clientY - drag.origin.y) * drag.direction.y;
    const value = Math.max(0, Math.min(1, drag.from + distance / drag.extent));
    if (control === "latch") {
      // Once open, the latch stays open only while this pointer is held.
      if (active.pull < .78) active.pull = value >= .78 ? 1 : value;
    } else {
      active.angle = value;
    }
    updatePreview();
  }

  function finishDrag(event: PointerEvent<HTMLElement>, control: Control, cancelled: boolean) {
    const active = manipulation.current;
    const drag = active[control];
    if (!drag || drag.id !== event.pointerId) return;
    active[control] = null;
    if (control === "latch") {
      relock(!cancelled);
    } else if (cancelled) {
      active.angle = drag.from;
      updatePreview();
    }
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (props.paused) return;
    const active = manipulation.current;
    if (event.code === "Space") {
      event.preventDefault();
      if (!active.latch) {
        viewer.current?.orbit(false);
        active.keyboard = true;
        active.pull = 1;
        updatePreview();
      }
      return;
    }
    if (active.pull < .78) return;
    const up = event.key === "ArrowUp" || event.key === "ArrowRight";
    const down = event.key === "ArrowDown" || event.key === "ArrowLeft";
    if (!up && !down) return;
    event.preventDefault();
    const step = Math.round((active.angle ?? props.notch / lastNotch) * lastNotch);
    active.angle = Math.max(0, Math.min(lastNotch, step + (up ? 1 : -1))) / lastNotch;
    updatePreview();
  }

  return (
    <div className="bench-view" data-model={status} data-unlocked={unlocked || undefined} data-aligned={aligned || undefined}
      tabIndex={0} aria-label="Трёхмерная скамья" aria-describedby={props.paused ? undefined : "bench-operation"}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) startDrag(event, "cushion");
      }}
      onPointerMove={(event) => {
        if (event.target === event.currentTarget) updateDrag(event, "cushion");
      }}
      onPointerUp={(event) => finishDrag(event, "cushion", false)}
      onPointerCancel={(event) => finishDrag(event, "cushion", true)}
      onLostPointerCapture={(event) => finishDrag(event, "cushion", true)}
      onKeyDown={keyDown} onKeyUp={(event) => {
        if (event.code === "Space" && manipulation.current.keyboard) {
          event.preventDefault();
          relock(true);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && manipulation.current.keyboard) relock(false);
      }}>
      <div className="bench-canvas" ref={surface} hidden={status === "failed"} />
      {status !== "ready" && (
        <div className="bench-view-placeholder">
          <Equipment name="bench" alt="Регулируемая скамья" />
          <p role="status">{status === "failed" ? "Схема регулировки" : "Загружается 3D-модель…"}</p>
        </div>
      )}
      {status === "ready" && (
        <button type="button" className="bench-camera-button" aria-label="Вернуть исходный ракурс"
          title="Вернуть исходный ракурс" onClick={() => viewer.current?.resetView()}><Icon name="rotate" size={20} /></button>
      )}
      {status === "ready" && props.target !== undefined && <span ref={goalMarker} className="bench-goal-marker" aria-hidden="true" />}
      {status !== "loading" && !props.paused && (["latch", "cushion"] as const).map((control) => (
        <button type="button" className="bench-marker" data-bench-control={control}
          data-active={unlocked || undefined}
          key={control} ref={control === "latch" ? latch : cushion} tabIndex={-1}
          aria-label={exercise[control].label}
          onPointerDown={(event) => startDrag(event, control)}
          onPointerMove={(event) => updateDrag(event, control)}
          onPointerUp={(event) => finishDrag(event, control, false)}
          onPointerCancel={(event) => finishDrag(event, control, true)}
          onLostPointerCapture={(event) => finishDrag(event, control, true)}>
          <Icon name="arrow" size={24} />
        </button>
      ))}
    </div>
  );
}
