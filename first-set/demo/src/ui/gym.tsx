import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { barbellLayout, type BarbellDestination } from "../engine/barbell";
import type { Action, Progress, Result } from "../engine/game";
import { barbell, barbellSides, floorId, rackTargets, type BarbellSide, type Station } from "../engine/scenario";
import { Icon, inventoryAsset, sceneAsset } from "./graphics";
import { SceneButton } from "./scene-button";

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
  const [landed, setLanded] = useState("");
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
      setLanded(prop.id);
      if (prop.pulse) navigator.vibrate?.(Array.isArray(prop.pulse) ? prop.pulse : 6);
    }
    return result;
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>, prop: Prop) {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    start.current = {
      prop, id: event.pointerId, moved: false, width: event.currentTarget.offsetWidth,
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
      setLanded("");
      if (held.prop.pulse) navigator.vibrate?.(held.prop.pulse);
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
          data-landed={landed === prop.id ? true : undefined}
          style={{
            left: prop.x + "%", top: prop.y + "%", width: "max(44px, " + prop.size + "%)",
            "--prop-x": -(prop.anchor?.[0] ?? 50) + "%", "--prop-y": -(prop.anchor?.[1] ?? 50) + "%",
            "--prop-angle": (prop.angle ?? 0) + "deg", zIndex: prop.layer ?? 3,
          } as CSSProperties}
          onAnimationEnd={() => setLanded((value) => value === prop.id ? "" : value)}
          onPointerDown={(event) => pointerDown(event, prop)}
          onPointerMove={pointerMove}
          onPointerUp={(event) => pointerEnd(event, false)}
          onPointerCancel={(event) => pointerEnd(event, true)}
          onLostPointerCapture={(event) => pointerEnd(event, true)}
          onKeyDown={(event) => pickWithKeyboard(event, prop)}>
          <img src={prop.src} alt="" draggable={false} />
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
        <img className="scene-carried" src={drag.prop.src} alt="" draggable={false}
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

const rack = [
  { x: 19.7, y: 12.7, width: 26, height: 15.2, rest: 16.2, positions: [14.5, 24.8] },
  { x: 50.0, y: 30.2, width: 26, height: 16.0, rest: 34.2, positions: [45.1, 55.1] },
  { x: 80.8, y: 30.2, width: 26, height: 16.0, rest: 34.2, positions: [75.8, 86.1] },
];

const scatter = [
  { x: 21, y: 56, size: 20, angle: -12 },
  { x: 76, y: 75, size: 23, angle: 16 },
  { x: 50, y: 65, size: 25, angle: -16 },
  { x: 48, y: 88, size: 26, angle: 14 },
  { x: 79, y: 50, size: 24, angle: -8 },
  { x: 19, y: 81, size: 27, angle: 16 },
];

const rackDropTargets = [
  ...rackTargets.map((target, index) => ({ ...target, ...rack[index] })),
  { id: floorId, label: "На пол перед стойкой", x: 50, y: 72.5, width: 96, height: 53 },
];

export function DumbbellScene({ station, progress, submit }: Props & { station: Station }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const assigned = progress.placements.DUMBBELLS;
  const pockets = rackTargets.map((target) => Object.keys(assigned).filter((id) => assigned[id] === target.id));
  const props = station.items.map<Prop>((item, index) => {
    const pocket = rackTargets.findIndex((target) => target.id === assigned[item.id]);
    const onRack = pocket >= 0;
    const position = onRack ? {
      x: rack[pocket].positions[pockets[pocket].indexOf(item.id)], y: rack[pocket].rest,
      size: 12.2, angle: -5, anchor: [50, 85] as const,
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
        {rack.map((pocket, index) => (
          <div className="rack-cradles" key={rackTargets[index].id} data-paired={pockets[index].length === 2} aria-hidden="true">
            {pocket.positions.map((x) => <span key={x} style={{ left: x + "%", top: pocket.rest + "%" }} />)}
          </div>
        ))}
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

const mountedSize = { 5: 13.5, 10: 16.7, 20: 20.5 };
const stockSize = { 5: 10.5, 10: 12.5, 20: 14.5 };
const weightPulse = { 5: 8, 10: 18, 20: 28 };
function onShaft(side: BarbellSide, index: number) {
  const x = side === "LEFT" ? 22.7 - index * 5.1 : 77.3 + index * 5.1;
  return { x, y: 1.9 + (0.585 - 0.17 * (x / 100 - 0.06) / 0.88) * 62 };
}

export function BarbellScene({ progress, submit }: Props) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const assembly = progress.barbell;
  const { totalKg, collarCount } = barbellLayout(assembly);
  const props = barbell.props.map<Prop>((prop) => {
    const side = barbellSides.find((end) => prop.kind === "disk"
      ? assembly.disks[end].includes(prop.id)
      : assembly.collars[end] === prop.id);
    const disk = prop.kind === "disk" ? prop : null;
    const position = side
      ? onShaft(side, disk ? assembly.disks[side].indexOf(prop.id) : assembly.disks[side].length)
      : traySpots[prop.id];
    const layer = side ? 4 + (disk ? assembly.disks[side].indexOf(prop.id) : assembly.disks[side].length) : 3;
    return {
      ...position, id: prop.id, label: prop.label, src: sceneAsset(disk ? "disk-" + disk.weightKg : "collar"),
      location: side ?? floorId, layer,
      size: disk ? (side ? mountedSize : stockSize)[disk.weightKg] : side ? 9.5 : 11.5,
      anchor: side ? (disk ? [68, 51.5] : [56, 61]) : undefined,
      pulse: disk ? weightPulse[disk.weightKg] : [10, 26, 9],
    };
  });

  function verify() {
    const result = submit({ kind: "check-barbell" });
    setFeedback(result.accepted ? null : { message: result.message, error: true });
  }

  return (
    <div className="barbell-board">
      <div className="barbell-mass">
        <div><span>Текущий вес</span><strong data-current-weight={totalKg} aria-live="polite">{totalKg} кг</strong></div>
        <p>Цель <strong>{barbell.targetKg} кг</strong></p>
      </div>
      <InteractionField name="barbell-table" props={props} targets={barbellTargets} feedback={feedback} setFeedback={setFeedback}
        onDrop={(prop, destination) => submit({ kind: "move-barbell", item: prop.id, destination: destination as BarbellDestination })}>
        <span className="barbell-shadow" aria-hidden="true" />
        <img className="shaft-art" src={sceneAsset("shaft")} alt="" draggable={false} />
        <span className="tray-legend" aria-hidden="true">Диски и замки</span>
      </InteractionField>
      <div className="assembly-note"><span>Гриф {barbell.shaftKg} кг входит в общий вес</span><span>Замки {collarCount}/2</span></div>
      <SceneFeedback feedback={feedback} />
      <SceneButton type="button" className="button primary assembly-check" onActivate={verify}>Проверить <Icon name="check" size={18} /></SceneButton>
    </div>
  );
}

const storage = [
  { x: 21, y: 14.8, width: 35, height: 23.5, shade: "blue" },
  { x: 79, y: 14.8, width: 35, height: 23.5, shade: "mint" },
  { x: 21, y: 85.5, width: 35, height: 22.0, shade: "lavender" },
  { x: 79, y: 85.5, width: 35, height: 22.0, shade: "peach" },
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
