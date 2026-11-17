import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { barbellLayout, type BarbellDestination } from "../engine/barbell";
import type { Action, Progress, Result } from "../engine/game";
import { barbell, barbellSides, floorId, rackRows, rackTargets, type BarbellSide, type Station } from "../engine/scenario";
import { asset, Icon, inventoryAsset, sceneAsset } from "./graphics";
import { SceneButton } from "./scene-button";
import barbellArt from "./barbell-art.json";

type Submit = (action: Action) => Result;
type Props = { progress: Progress; submit: Submit };
type Point = { x: number; y: number };
type Prop = Point & {
  id: string;
  label: string;
  src: string;
  stationary?: boolean;
  size: number;
  location: string;
  angle?: number;
  anchor?: readonly [number, number];
  layer?: number;
  pulse?: number | number[];
  tone?: "coral" | "aqua";
  mounted?: { slide: Point; clamp?: { ratio: number; closed: boolean } };
  dragSrc?: string;
};
type Target = Point & { id: string; label: string; width: number; height: number };
type Held = {
  prop: Prop;
  id: number;
  origin: Point;
  offset: Point;
  width: number;
  moved: boolean;
};
type Drag = Point & { prop: Prop; width: number; over?: string };
type Feedback = { message: string; error?: boolean; target?: string };

function InteractionField({ name, props, targets, feedback, setFeedback, onDrop, children }: {
  name: string;
  props: readonly Prop[];
  targets: readonly Target[];
  feedback: Feedback | null;
  setFeedback: (feedback: Feedback | null) => void;
  onDrop: (prop: Prop, destination: string) => Result;
  children: ReactNode;
}) {
  const field = useRef<HTMLDivElement>(null);
  const start = useRef<Held | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [landed, setLanded] = useState<readonly string[]>([]);
  const [keyboard, setKeyboard] = useState<Prop | null>(null);

  function targetAt(event: PointerEvent) {
    const bounds = field.current!.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * 100 / bounds.width;
    const y = (event.clientY - bounds.top) * 100 / bounds.height;
    return targets.find((target) =>
      Math.abs(x - target.x) <= target.width / 2 && Math.abs(y - target.y) <= target.height / 2,
    )?.id;
  }

  function commit(prop: Prop, target: string) {
    const result = onDrop(prop, target);
    setFeedback(result.message ? { message: result.message, error: !result.accepted, target } : null);
    if (result.accepted) {
      setLanded((ids) => ids.includes(prop.id) ? ids : [...ids, prop.id]);
      if (prop.pulse && target !== floorId && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        navigator.vibrate?.(prop.pulse);
      }
    }
    return result;
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>, prop: Prop) {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = field.current ? field.current.getBoundingClientRect().width / field.current.offsetWidth : 1;
    start.current = {
      prop, id: event.pointerId, moved: false, width: event.currentTarget.offsetWidth * scale,
      origin: { x: event.clientX, y: event.clientY },
      offset: { x: event.clientX - rect.left, y: event.clientY - rect.top },
    };
    setKeyboard(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const held = start.current;
    if (!held || held.id !== event.pointerId) return;
    if (!held.moved) {
      if (Math.hypot(event.clientX - held.origin.x, event.clientY - held.origin.y) < 6) return;
      held.moved = true;
      setFeedback(null);
      setLanded((ids) => ids.filter((id) => id !== held.prop.id));
    }
    setDrag({
      prop: held.prop, width: held.width,
      x: event.clientX - held.offset.x, y: event.clientY - held.offset.y,
      over: targetAt(event),
    });
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const held = start.current;
    if (!held || held.id !== event.pointerId) return;
    start.current = null;
    setDrag(null);
    if (!held.moved || cancelled) return;
    const target = targetAt(event);
    if (target) commit(held.prop, target);
  }

  function focusProp(prop: Prop) {
    field.current?.querySelector<HTMLElement>('[data-scene-item="' + prop.id + '"]')?.focus({ preventScroll: true });
  }

  function pickWithKeyboard(event: KeyboardEvent, prop: Prop) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    setKeyboard(prop);
    setFeedback({ message: "Выбери место клавишей Tab и нажми пробел." });
    field.current?.querySelector<HTMLElement>("[data-scene-target]")?.focus({ preventScroll: true });
  }

  return (
    <div className={"interaction-field " + name} ref={field}
      onKeyDown={(event) => {
        if (event.key === "Escape" && keyboard) {
          focusProp(keyboard);
          setKeyboard(null);
          setFeedback(null);
        }
      }}>
      {children}
      {props.map((prop) => (
        <div key={prop.id} className="scene-prop"
          role="img" aria-label={prop.label} aria-keyshortcuts={prop.stationary ? undefined : "Enter Space"}
          tabIndex={prop.stationary ? undefined : 0}
          data-scene-item={prop.id} data-location={prop.location} data-stationary={prop.stationary || undefined}
          data-held={drag?.prop.id === prop.id ? true : undefined}
          data-keyboard={keyboard?.id === prop.id ? true : undefined}
          data-landed={landed.includes(prop.id) || undefined}
          data-coaxial={Boolean(prop.mounted) || undefined}
          data-clamp={Boolean(prop.mounted?.clamp) || undefined}
          style={{
            left: prop.x + "%", top: prop.y + "%", width: prop.mounted ? prop.size + "%" : "max(44px, " + prop.size + "%)",
            "--prop-x": -(prop.anchor?.[0] ?? 50) + "%", "--prop-y": -(prop.anchor?.[1] ?? 50) + "%",
            "--prop-angle": (prop.angle ?? 0) + "deg",
            "--slide-x": (prop.mounted?.slide.x ?? 0) + "%",
            "--slide-y": (prop.mounted?.slide.y ?? 0) + "%",
            zIndex: prop.layer ?? 3,
          } as CSSProperties}
          onAnimationEnd={(event) => {
            if (event.animationName !== "slide-on-bar" && event.animationName !== "settle-prop") return;
            setLanded((ids) => ids.filter((id) => id !== prop.id));
            if (event.animationName === "slide-on-bar" && prop.pulse) navigator.vibrate?.(prop.pulse);
          }}
          onPointerDown={(event) => pointerDown(event, prop)}
          onPointerMove={pointerMove}
          onPointerUp={(event) => pointerEnd(event, false)}
          onPointerCancel={(event) => pointerEnd(event, true)}
          onLostPointerCapture={(event) => pointerEnd(event, true)}
          onKeyDown={(event) => pickWithKeyboard(event, prop)}>
          {prop.mounted?.clamp ? (
            <div className="mounted-art">
              <div className="clamp-sprite" data-closed={prop.mounted.clamp.closed || undefined}
                style={{ aspectRatio: prop.mounted.clamp.ratio, backgroundImage: "url(" + prop.src + ")" }} />
            </div>
          ) : <img className={prop.mounted ? "mounted-art" : undefined} src={prop.src} data-prop-tone={prop.tone} alt="" draggable={false} />}
        </div>
      ))}
      {targets.map((target) => (
        <div key={target.id} className="scene-drop" role="button" tabIndex={0} aria-label={target.label}
          data-scene-target={target.id}
          data-over={drag?.over === target.id ? true : undefined}
          data-rejected={feedback?.error && feedback.target === target.id ? true : undefined}
          style={{
            left: target.x + "%", top: target.y + "%", width: target.width + "%", height: target.height + "%",
          }}
          onKeyDown={(event) => {
            if (!keyboard || (event.key !== " " && event.key !== "Enter")) return;
            event.preventDefault();
            if (commit(keyboard, target.id).accepted) {
              focusProp(keyboard);
              setKeyboard(null);
            }
          }} />
      ))}
      {drag && createPortal(
        <img className="scene-carried" src={drag.prop.dragSrc ?? drag.prop.src} data-prop-tone={drag.prop.tone} alt="" draggable={false}
          style={{ left: drag.x, top: drag.y, width: drag.width, rotate: (drag.prop.angle ?? 0) + "deg" }} />,
        document.body,
      )}
    </div>
  );
}

function SceneFeedback({ feedback }: { feedback: Feedback | null }) {
  return <p className="scene-response" data-error={feedback?.error ? true : undefined} role="status" aria-live="polite">
    {feedback?.message && <><Icon name={feedback.error ? "info" : "check"} size={17} />{feedback.message}</>}
  </p>;
}

const rackShelves = [
  { rest: 16.3, centers: [14.5, 24.8, 35.1, 45.4, 55.7, 65.9, 76.2, 86.5] },
  { rest: 34.2, centers: [13.9, 24.2, 34.6, 44.9, 55.2, 65.5, 75.8, 86.1] },
];
const rackPockets = rackRows.flatMap((weights, shelf) => weights.map((weight, pair) => {
  const { centers, rest } = rackShelves[shelf];
  const positions = [centers[pair * 2], centers[pair * 2 + 1]];
  const target = rackTargets.find((spot) => spot.weightKg === weight);
  return { weight, shelf, pair, positions, rest, x: (positions[0] + positions[1]) / 2, target };
}));

const scatter = [
  { x: 21, y: 56, size: 20, angle: -12 },
  { x: 76, y: 75, size: 23, angle: 16 },
  { x: 50, y: 65, size: 25, angle: -16 },
  { x: 48, y: 88, size: 26, angle: 14 },
  { x: 79, y: 50, size: 24, angle: -8 },
  { x: 19, y: 81, size: 27, angle: 16 },
];

const rackDropTargets = [
  ...rackPockets.flatMap(({ target, x, rest }) => target ? [
    { ...target, x, y: rest - 4.3, width: 20.2, height: 12.8 },
  ] : []),
  { id: floorId, label: "На пол перед стойкой", x: 50, y: 72.5, width: 96, height: 53 },
];

export function DumbbellScene({ station, progress, submit }: Props & { station: Station }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const assigned = progress.placements.DUMBBELLS;
  const props = station.items.map<Prop>((item, index) => {
    const spot = rackPockets.find((pocket) => pocket.target && pocket.target.id === assigned[item.id]);
    const pair = spot ? Object.keys(assigned).filter((id) => assigned[id] === spot.target?.id) : [];
    const position = spot ? {
      x: spot.positions[pair.indexOf(item.id)], y: spot.rest,
      size: 11.8, angle: -5, anchor: [50, 85] as const,
    } : scatter[index];
    return {
      ...position, id: item.id, label: item.label, location: assigned[item.id] ?? floorId,
      src: sceneAsset("dumbbell-" + item.weightKg),
    };
  });

  return (
    <div className="dumbbell-board">
      <InteractionField name="gym-floor" props={props} targets={rackDropTargets} feedback={feedback} setFeedback={setFeedback}
        onDrop={(prop, destination) => submit({ kind: "place", stage: "DUMBBELLS", item: prop.id, destination })}>
        <img className="scene-backdrop" src={sceneAsset("gym-floor")} alt="" draggable={false} />
        {rackPockets.map((pocket) => {
          const paired = pocket.target && props.filter((prop) => prop.location === pocket.target?.id).length === 2;
          return (
            <div className="rack-pair" data-shelf={pocket.shelf + 1} data-first-slot={pocket.pair * 2 + 1}
              data-weight={pocket.weight} data-paired={paired || undefined} aria-hidden="true" key={pocket.weight}>
              {pocket.positions.map((x) => pocket.target
                ? <span className="rack-cradle" key={x} style={{ left: x + "%", top: pocket.rest + "%" }} />
                : <img className="rack-stock" key={x} src={asset("rack-stock")} alt=""
                    style={{ left: x + "%", top: pocket.rest + "%", width: (9 + pocket.weight * .17) + "%" }} />)}
              <span className="rack-weight" data-task={Boolean(pocket.target)} style={{ left: pocket.x + "%", top: (pocket.rest + 2.4) + "%" }}>
                {pocket.weight} кг
              </span>
            </div>
          );
        })}
      </InteractionField>
      <SceneFeedback feedback={feedback} />
    </div>
  );
}

const barbellTargets = [
  { id: "LEFT", label: "Левая втулка грифа", x: 19, y: 35, width: 36, height: 42 },
  { id: "RIGHT", label: "Правая втулка грифа", x: 81, y: 31, width: 36, height: 42 },
  { id: floorId, label: "Лоток для дисков и замков", x: 50, y: 78, width: 98, height: 44 },
] as const;

const traySpots: Record<string, Point & { angle: number }> = {
  DISK_20_A: { x: 35, y: 87, angle: -9 },
  DISK_20_B: { x: 52, y: 88, angle: 11 },
  DISK_5_A: { x: 12, y: 66, angle: -17 },
  DISK_5_B: { x: 29, y: 70, angle: 14 },
  DISK_5_C: { x: 70, y: 88, angle: 20 },
  DISK_5_D: { x: 87, y: 87, angle: -15 },
  DISK_10_A: { x: 49, y: 65, angle: -9 },
  DISK_10_B: { x: 69, y: 66, angle: 7 },
  LOCK_A: { x: 88, y: 66, angle: 15 },
  LOCK_B: { x: 13, y: 88, angle: -12 },
};

const stockSize = { 5: 10.5, 10: 12.5, 20: 14.5 };
const diskDetails = {
  5: { asset: "bar-disk-5", thickness: .029, pulse: undefined },
  10: { asset: "bar-disk-10", thickness: .045, pulse: 13 },
  20: { asset: "bar-disk-20", thickness: .065, pulse: [40, 16, 22] },
} as const;

function onShaft(axial: number) {
  return { x: 50 + barbellArt.axis[0] * axial, y: 30 + barbellArt.axis[1] * axial };
}

export function BarbellScene({ progress, submit }: Props) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const assembly = progress.barbell;
  const { totalKg, collarCount } = barbellLayout(assembly);
  const mounts = new Map<string, { side: BarbellSide; axial: number; thickness: number }>();
  for (const side of barbellSides) {
    const sign = side === "LEFT" ? -1 : 1;
    let end = .662;
    for (const id of assembly.disks[side]) {
      const disk = barbell.props.find((prop) => prop.id === id);
      if (disk?.kind !== "disk") continue;
      const { thickness } = diskDetails[disk.weightKg];
      mounts.set(id, { side, axial: sign * (end + thickness / 2), thickness });
      end += thickness + .003;
    }
    const clamp = assembly.collars[side];
    if (clamp) mounts.set(clamp, { side, axial: sign * (end + .026), thickness: .052 });
  }

  const props = barbell.props.map<Prop>((prop) => {
    const disk = prop.kind === "disk" ? prop : null;
    const details = disk ? diskDetails[disk.weightKg] : null;
    const mount = mounts.get(prop.id);
    const dragSrc = sceneAsset(disk ? "disk-" + disk.weightKg : "collar");
    const pulse = details?.pulse === undefined ? undefined
      : typeof details.pulse === "number" ? details.pulse : Array.from(details.pulse);
    if (!mount) return {
      ...traySpots[prop.id], id: prop.id, label: prop.label, src: dragSrc, pulse, location: floorId,
      size: disk ? stockSize[disk.weightKg] : 11.5, tone: disk ? disk.weightKg === 5 ? "aqua" : undefined : "coral",
    };
    const name = details?.asset ?? "bar-clamp";
    const art = barbellArt.parts[name];
    const end = onShaft(Math.sign(mount.axial) * (1.105 + mount.thickness / 2));
    const position = onShaft(mount.axial);
    return {
      ...position, id: prop.id, label: prop.label, src: asset(name), dragSrc, pulse, location: mount.side,
      layer: 90 + Math.round(mount.axial * 70), size: art.width, anchor: [art.anchor[0], art.anchor[1]],
      mounted: {
        slide: { x: (end.x - position.x) / art.width * 100, y: (end.y - position.y) / art.height * 100 },
        clamp: disk ? undefined : { ratio: art.ratio, closed: Boolean(assembly.locked[mount.side]) },
      },
    };
  });

  function verify() {
    const result = submit({ kind: "check-barbell" });
    setFeedback(result.accepted ? null : { message: result.message, error: true });
  }

  const shaft = barbellArt.parts["bar-shaft"];
  return (
    <div className="barbell-board">
      <div className="barbell-mass">
        <div><span>Текущий вес</span><strong key={totalKg} data-current-weight={totalKg} aria-live="polite">{totalKg} кг</strong></div>
        <p>Цель <strong>{barbell.targetKg} кг</strong></p>
      </div>
      <InteractionField name="barbell-table" props={props} targets={barbellTargets} feedback={feedback} setFeedback={setFeedback}
        onDrop={(prop, destination) => submit({ kind: "move-barbell", item: prop.id, destination: destination as BarbellDestination })}>
        <span className="barbell-shadow" aria-hidden="true" />
        <img className="shaft-art" src={asset("bar-shaft")} alt="" draggable={false}
          style={{ left: onShaft(0).x + "%", top: onShaft(0).y + "%", width: shaft.width + "%",
            transform: "translate(" + -shaft.anchor[0] + "%," + -shaft.anchor[1] + "%)" }} />
        <span className="tray-legend" aria-hidden="true">Диски и замки</span>
        {barbellSides.map((side) => {
          const id = assembly.collars[side];
          const mount = id ? mounts.get(id) : undefined;
          if (!mount) return null;
          const { x, y } = onShaft(mount.axial);
          const closed = Boolean(assembly.locked[side]);
          const sideLabel = side === "LEFT" ? "левый" : "правый";
          return (
            <SceneButton key={side} type="button" className="barbell-latch-action" aria-pressed={closed}
              aria-label={(closed ? "Открыть " : "Защёлкнуть ") + sideLabel + " замок"}
              style={{ left: x + "%", top: (y - 12.5) + "%" }} onActivate={() => {
                const result = submit({ kind: "toggle-collar", side });
                if (result.accepted) setFeedback(null);
              }}>
              <span><Icon name={closed ? "lock" : "unlock"} size={14} /></span>
            </SceneButton>
          );
        })}
      </InteractionField>
      <div className="assembly-note"><span>Гриф {barbell.shaftKg} кг входит в общий вес</span><span>Защёлкнуто {collarCount}/2</span></div>
      <SceneFeedback feedback={feedback} />
      <SceneButton type="button" className="button primary assembly-check" onActivate={verify}>Проверить <Icon name="check" size={18} /></SceneButton>
    </div>
  );
}

const storage = [
  { x: 21, y: 14.8, width: 35, height: 23.5, shade: "aqua" },
  { x: 79, y: 14.8, width: 35, height: 23.5, shade: "surface" },
  { x: 21, y: 85.5, width: 35, height: 22.0, shade: "light" },
  { x: 79, y: 85.5, width: 35, height: 22.0, shade: "coral" },
];
const looseInventory = [
  { x: 21, y: 39, angle: -13, size: 20 },
  { x: 48, y: 32, angle: 18, size: 15 },
  { x: 74, y: 39, angle: -20, size: 16 },
  { x: 89, y: 55, angle: 16, size: 17 },
  { x: 12, y: 61, angle: 16, size: 20 },
  { x: 38, y: 65, angle: -17, size: 15 },
  { x: 56, y: 47, angle: 10, size: 16 },
  { x: 65, y: 66, angle: -18, size: 17 },
];

export function InventoryScene({ station, progress, submit }: Props & { station: Station }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const assigned = progress.placements.INVENTORY;
  const zones = station.targets.map((target, index) => ({
    ...target, ...storage[index],
    items: Object.keys(assigned).filter((id) => assigned[id] === target.id),
  }));
  const props = station.items.map<Prop>((item, index) => {
    const bin = zones.find((zone) => zone.id === assigned[item.id]);
    const position = bin ? {
      x: bin.x + (bin.items[0] === item.id ? -8 : 8), y: bin.y + 3, size: 16.5,
    } : looseInventory[index];
    return {
      ...position, id: item.id, label: item.label, location: bin?.id ?? floorId,
      src: inventoryAsset(item), stationary: Boolean(bin),
    };
  });
  return (
    <div className="inventory-board">
      <InteractionField name="storage-floor" props={props} targets={zones} feedback={feedback} setFeedback={setFeedback}
        onDrop={(prop, destination) => submit({ kind: "place", stage: "INVENTORY", item: prop.id, destination })}>
        <img className="scene-backdrop" src={sceneAsset("gym-floor")} alt="" draggable={false} />
        {zones.map((zone) => (
          <div className="storage-area" data-shade={zone.shade} data-full={zone.items.length === 2 || undefined} key={zone.id}
            style={{ left: zone.x + "%", top: zone.y + "%", width: zone.width + "%", height: zone.height + "%" }}>
            <span>{zone.label}</span>
          </div>
        ))}
      </InteractionField>
      <SceneFeedback feedback={feedback} />
    </div>
  );
}
