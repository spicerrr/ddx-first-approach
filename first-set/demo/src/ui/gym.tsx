import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createPortal, preload } from "react-dom";
import { barbellLayout, diskHint, type BarbellDestination } from "../engine/barbell";
import type { Action, Progress, Result } from "../engine/game";
import { barbell, barbellSides, floorId, inventoryPlateWeights, plateRackSlot, rackRows, rackTargets, stationDetails, type BarbellSide, type Station } from "../engine/scenario";
import { asset, Icon, inventoryAsset } from "./graphics";
import { SceneButton } from "./scene-button";
import { CoachFeedback } from "./coach-message";
import barbellArt from "./barbell-art.json";
import rackArt from "./rack-art.json";

type Submit = (action: Action) => Result;
type Props = { progress: Progress; submit: Submit };
type Point = { x: number; y: number };
type Prop = Point & {
  id: string;
  label: string;
  caption?: string;
  src: string;
  stationary?: boolean;
  size: number;
  location: string;
  angle?: number;
  anchor?: readonly [number, number];
  layer?: number;
  pulse?: number | number[];
  fitted?: boolean;
  mounted?: { slide: Point; clamp?: { ratio: number; height: number; closed: boolean } };
  dragSrc?: string;
  outermostId?: string;
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
type Feedback = { message: string; kind: "warning" | "guide"; returned?: string };

function InteractionField({ name, props, targets, feedback, setFeedback, onDrop, tapToPlace = false, children }: {
  name: string;
  props: readonly Prop[];
  targets: readonly Target[];
  feedback: Feedback | null;
  setFeedback: (feedback: Feedback | null) => void;
  onDrop: (prop: Prop, destination: string) => Result;
  tapToPlace?: boolean;
  children: ReactNode;
}) {
  const field = useRef<HTMLDivElement>(null);
  const start = useRef<Held | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [landed, setLanded] = useState<readonly string[]>([]);
  const [selected, setSelected] = useState<Prop | null>(null);

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
    if (result.accepted) {
      setFeedback(result.message ? { kind: "guide", message: result.message } : null);
      setLanded((ids) => ids.includes(prop.id) ? ids : [...ids, prop.id]);
      if (prop.pulse && target !== floorId && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        navigator.vibrate?.(prop.pulse);
      }
    } else if (result.message) {
      setFeedback({ kind: "warning", message: result.message, returned: prop.id });
    }
    return result;
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>, prop: Prop) {
    if (!event.isPrimary || event.button !== 0 || start.current) return;
    const picked = props.find((item) => item.id === prop.outermostId) ?? prop;
    const rect = event.currentTarget.getBoundingClientRect();
    const width = picked === prop ? rect.width : field.current!.getBoundingClientRect().width * picked.size / 100;
    start.current = {
      prop: picked, id: event.pointerId, moved: false, width,
      origin: { x: event.clientX, y: event.clientY },
      offset: picked === prop ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : { x: width / 2, y: width / 2 },
    };
    if (!tapToPlace) setSelected(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const held = start.current;
    if (!held || held.id !== event.pointerId) return;
    if (!held.moved) {
      if (Math.hypot(event.clientX - held.origin.x, event.clientY - held.origin.y) < 6) return;
      held.moved = true;
      setSelected(null);
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
    if (cancelled) return;
    if (!held.moved) {
      if (tapToPlace && selected?.id === held.prop.id) cancelSelection();
      else if (tapToPlace) select(held.prop, false);
      return;
    }
    const target = targetAt(event);
    if (target) commit(held.prop, target);
  }

  function focusProp(prop: Prop) {
    field.current?.querySelector<HTMLElement>('[data-scene-item="' + prop.id + '"]')?.focus({ preventScroll: true });
  }

  function select(prop: Prop, usingKeyboard: boolean) {
    setSelected(prop);
    if (feedback?.kind !== "warning") {
      setFeedback({
        kind: "guide",
        message: usingKeyboard ? "Выбери место клавишей Tab и нажми пробел." : "Теперь можно нажать на место хранения.",
      });
    }
    if (usingKeyboard) {
      field.current?.querySelector<HTMLElement>("[data-scene-target]")?.focus({ preventScroll: true });
    }
  }

  function cancelSelection() {
    if (!selected) return;
    focusProp(selected);
    setSelected(null);
    if (feedback?.kind === "guide") setFeedback(null);
  }

  function placeSelected(target: string) {
    if (selected && commit(selected, target).accepted) {
      focusProp(selected);
      setSelected(null);
    }
  }

  return (
    <div className={"interaction-field " + name} ref={field}
      data-tap-ready={tapToPlace && Boolean(selected) || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") cancelSelection();
      }}>
      {children}
      {props.map((prop) => (
        <div key={prop.id} className="scene-prop"
          role="img" aria-label={prop.label} aria-keyshortcuts={prop.stationary ? undefined : "Enter Space"}
          tabIndex={prop.stationary ? undefined : 0}
          data-scene-item={prop.id} data-location={prop.location} data-stationary={prop.stationary || undefined}
          data-held={drag?.prop.id === prop.id ? true : undefined}
          data-selected={selected?.id === prop.id || undefined}
          data-landed={landed.includes(prop.id) || undefined}
          data-bumped={feedback?.returned === prop.id || undefined}
          data-coaxial={Boolean(prop.mounted) || undefined}
          data-fitted={prop.fitted || undefined}
          data-clamp={Boolean(prop.mounted?.clamp) || undefined}
          style={{
            left: (prop.x - (prop.mounted?.clamp ? prop.size * (prop.anchor?.[0] ?? 50) / 100 : 0)) + "%",
            top: (prop.y - (prop.mounted?.clamp ? prop.mounted.clamp.height * (prop.anchor?.[1] ?? 50) / 100 : 0)) + "%",
            width: prop.mounted || prop.fitted ? prop.size + "%" : "max(44px, " + prop.size + "%)",
            "--prop-x": -(prop.anchor?.[0] ?? 50) + "%", "--prop-y": -(prop.anchor?.[1] ?? 50) + "%",
            "--prop-angle": (prop.angle ?? 0) + "deg",
            "--slide-x": (prop.mounted?.slide.x ?? 0) + "%",
            "--slide-y": (prop.mounted?.slide.y ?? 0) + "%",
            "--clamp-art-layer": prop.mounted?.clamp ? prop.layer : undefined,
            zIndex: prop.mounted?.clamp ? undefined : prop.layer ?? 3,
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
          onKeyDown={(event) => {
            if (event.key !== " " && event.key !== "Enter") return;
            event.preventDefault();
            select(prop, true);
          }}>
          {prop.mounted?.clamp ? (
            <div className="mounted-art">
              <div className="clamp-sprite" data-closed={prop.mounted.clamp.closed || undefined}
                style={{ aspectRatio: prop.mounted.clamp.ratio, backgroundImage: "url(" + prop.src + ")" }} />
            </div>
          ) : <img className={prop.mounted ? "mounted-art" : undefined} src={prop.src} alt="" draggable={false} />}
          {prop.caption && <span className="scene-prop-caption" aria-hidden="true">{prop.caption}</span>}
        </div>
      ))}
      {targets.map((target) => (
        <div key={target.id} className="scene-drop" role="button" tabIndex={0} aria-label={target.label}
          data-scene-target={target.id}
          data-over={drag?.over === target.id ? true : undefined}
          style={{
            left: target.x + "%", top: target.y + "%", width: target.width + "%", height: target.height + "%",
          }}
          onClick={tapToPlace ? () => placeSelected(target.id) : undefined}
          onKeyDown={(event) => {
            if (!selected || (event.key !== " " && event.key !== "Enter")) return;
            event.preventDefault();
            placeSelected(target.id);
          }} />
      ))}
      {drag && createPortal(
        <img className="scene-carried" src={drag.prop.dragSrc ?? drag.prop.src} alt="" draggable={false}
          style={{ left: drag.x, top: drag.y, width: drag.width, rotate: (drag.prop.angle ?? 0) + "deg" }} />,
        document.body,
      )}
    </div>
  );
}

const rackPockets = rackRows.flatMap((weights, shelf) => weights.map((weight, pair) => {
  const [first, second] = rackArt.shelves[shelf].slice(pair * 2, pair * 2 + 2);
  const positions = [first[0], second[0]];
  const target = rackTargets.find((spot) => spot.weightKg === weight);
  return { weight, shelf, pair, positions, rest: first[1], x: (positions[0] + positions[1]) / 2, target };
}));

const scatter = [
  { x: 22, y: 65, size: 19, angle: -13 },
  { x: 77, y: 86, size: 19, angle: 18 },
  { x: 50, y: 69, size: 21, angle: 12 },
  { x: 45, y: 88, size: 21, angle: -13 },
  { x: 80, y: 63, size: 22, angle: 3 },
  { x: 19, y: 84, size: 22, angle: 12 },
];

const rackDropTargets = [
  ...rackPockets.flatMap(({ target, x, rest }) => target ? [
    { ...target, x, y: rest - 2.2, width: 19.7, height: 14.8 },
  ] : []),
  { id: floorId, label: "На пол перед стойкой", x: 50, y: 79, width: 97, height: 42 },
];

export function DumbbellScene({ station, progress, submit }: Props & { station: Station }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const assigned = progress.placements.DUMBBELLS;
  const placements = Object.values(assigned);
  const lastPair = rackTargets.find(({ id }) => id === placements.at(-1));
  const message = !lastPair ? stationDetails.DUMBBELLS.instruction
    : placements.filter((id) => id === lastPair.id).length === 2
      ? `Пара ${lastPair.weightKg} кг на месте. Посмотри, какие гантели ещё остались на полу.`
      : `Гантель ${lastPair.weightKg} кг на месте. Найди вторую с таким же весом.`;
  const props = station.items.map<Prop>((item, index) => {
    const spot = rackPockets.find((pocket) => pocket.target && pocket.target.id === assigned[item.id]);
    const pair = spot ? Object.keys(assigned).filter((id) => assigned[id] === spot.target?.id) : [];
    const art = rackArt.parts[String(item.weightKg) as keyof typeof rackArt.parts];
    const dragSrc = asset("dumbbell-floor-" + item.weightKg);
    const position = spot ? {
      x: spot.positions[pair.indexOf(item.id)], y: spot.rest,
      size: art.width, anchor: [art.anchor[0], art.anchor[1]] as const,
    } : scatter[index];
    return {
      ...position, id: item.id, label: item.label, location: assigned[item.id] ?? floorId,
      src: spot ? asset("rack-dumbbell-" + item.weightKg) : dragSrc,
      dragSrc, fitted: Boolean(spot),
    };
  });

  return (
    <div className="dumbbell-board">
      <CoachFeedback hint={feedback?.kind === "warning" ? feedback.message : null}
        message={feedback?.kind === "guide" ? feedback.message : message} />
      <InteractionField name="gym-floor" props={props} targets={rackDropTargets} feedback={feedback} setFeedback={setFeedback}
        onDrop={(prop, destination) => {
          const result = submit({ kind: "place", stage: "DUMBBELLS", item: prop.id, destination });
          return result.accepted && destination === floorId
            ? { ...result, message: "Гантель снова на полу. Можно поставить её в пару." }
            : result;
        }}>
        <img className="scene-backdrop" src={asset("rack-studio")} draggable={false}
          alt="На верхней полке стоят пары 2, 4 и 6 кг. На нижней стоят пары 10 и 14 кг." />
        {rackPockets.map((pocket) => {
          const paired = pocket.target && props.filter((prop) => prop.location === pocket.target?.id).length === 2;
          return (
            <span className="rack-pair" data-shelf={pocket.shelf + 1} data-first-slot={pocket.pair * 2 + 1}
              data-paired={paired || undefined} aria-hidden="true" key={pocket.weight}
              style={{ left: pocket.x + "%", top: pocket.rest + "%" }} />
          );
        })}
      </InteractionField>
    </div>
  );
}

const barbellTargets = [
  { id: "LEFT", label: "Левая втулка грифа", ...onShaft(-.83), width: 31, height: 34 },
  { id: "RIGHT", label: "Правая втулка грифа", ...onShaft(.83), width: 31, height: 34 },
  { id: floorId, label: "Лоток для дисков и замков", x: 50, y: 75, width: 98, height: 49 },
] as const;

const traySlots = [
  ["DISK_5_A", "DISK_5_B", "DISK_10_A", "DISK_20_A", "LOCK_A"],
  ["DISK_5_C", "DISK_5_D", "DISK_10_B", "DISK_20_B", "LOCK_B"],
] as const;
const traySpots = Object.fromEntries(traySlots.flatMap((row, y) =>
  row.map((id, x) => [id, { x: 12.4 + 18.8 * x, y: 67 + 20.5 * y }] as const),
));

const stockSize = { 5: 9.5, 10: 11.3, 20: 13.6 };
const diskDetails = {
  5: { asset: "bar-disk-5", thickness: .029, pulse: undefined },
  10: { asset: "bar-disk-10", thickness: .045, pulse: 13 },
  20: { asset: "bar-disk-20", thickness: .065, pulse: [40, 16, 22] },
} as const;

function onShaft(axial: number) {
  return { x: 50 + barbellArt.axis[0] * axial, y: 26 + barbellArt.axis[1] * axial };
}

export function BarbellScene({ progress, submit }: Props) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const assembly = progress.barbell;
  const layout = barbellLayout(assembly);
  const { totalKg, collarCount, disksReady } = layout;
  const mountedCollars = Object.keys(assembly.collars).length;
  const message = collarCount === 2 ? "Оба замка защёлкнуты. Можно проверить сборку."
    : mountedCollars === 2 ? "Замки на месте. Осталось закрыть рычажки."
      : disksReady ? mountedCollars === 1 ? "Один замок на месте. Проверь вторую сторону."
        : "Вес совпал. Теперь можно надеть замки и закрыть рычажки."
        : totalKg > barbell.shaftKg ? `Слева ${layout.leftKg} кг, справа ${layout.rightKg} кг. Цель — по ${(barbell.targetKg - barbell.shaftKg) / 2} кг дисков на сторону.`
          : stationDetails.BARBELL.instruction;
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
    const dragSrc = asset(disk ? "bar-tray-" + disk.weightKg : "bar-tray-collar");
    const pulse = details?.pulse === undefined ? undefined
      : typeof details.pulse === "number" ? details.pulse : Array.from(details.pulse);
    if (!mount) return {
      ...traySpots[prop.id], id: prop.id, label: prop.label, src: dragSrc, pulse, location: floorId,
      size: disk ? stockSize[disk.weightKg] : 10.7,
    };
    const name = details?.asset ?? "bar-clamp";
    const art = barbellArt.parts[name];
    const end = onShaft(Math.sign(mount.axial) * (1.105 + mount.thickness / 2));
    const position = onShaft(mount.axial);
    return {
      ...position, id: prop.id, label: prop.label, src: asset(name), dragSrc, pulse, location: mount.side,
      outermostId: disk && !assembly.collars[mount.side] ? assembly.disks[mount.side].at(-1) : undefined,
      layer: 90 + Math.round(mount.axial * 70), size: art.width, anchor: [art.anchor[0], art.anchor[1]],
      mounted: {
        slide: { x: (end.x - position.x) / art.width * 100, y: (end.y - position.y) / art.height * 100 },
        clamp: disk ? undefined : { ratio: art.ratio, height: art.height, closed: Boolean(assembly.locked[mount.side]) },
      },
    };
  });

  function verify() {
    const result = submit({ kind: "check-barbell" });
    setFeedback(result.accepted ? null : { kind: "warning", message: result.message });
  }

  const shaft = barbellArt.parts["bar-shaft"];
  return (
    <div className="barbell-board">
      <CoachFeedback message={feedback?.kind === "guide" ? feedback.message : message}
        hint={feedback?.kind === "warning" ? feedback.message : totalKg === barbell.targetKg ? diskHint(layout) : null} />
      <div className="barbell-mass">
        <div><span>Текущий вес</span><strong key={totalKg} data-current-weight={totalKg} aria-live="polite">{totalKg} кг</strong></div>
        <p>Цель <strong>{barbell.targetKg} кг</strong></p>
      </div>
      <InteractionField key={resetCount} name="barbell-table" props={props} targets={barbellTargets} feedback={feedback} setFeedback={setFeedback}
        onDrop={(prop, destination) => {
          const result = submit({ kind: "move-barbell", item: prop.id, destination: destination as BarbellDestination });
          return result.accepted && barbellLayout(result.progress.barbell).totalKg === barbell.shaftKg
            ? { ...result, message: "Гриф снова пустой. Теперь можно собрать вес заново." }
            : result;
        }}>
        <span className="barbell-shadow" aria-hidden="true" />
        <img className="shaft-art" src={asset("bar-shaft")} alt="" draggable={false}
          style={{ left: onShaft(0).x + "%", top: onShaft(0).y + "%", width: shaft.width + "%",
            transform: "translate(" + -shaft.anchor[0] + "%," + -shaft.anchor[1] + "%)" }} />
        <div className="barbell-tray" aria-hidden="true">
          {["5 кг", "10 кг", "20 кг", "Замки"].map((label, index) => <span key={label} data-next={index === 3 && disksReady || undefined}>{label}</span>)}
        </div>
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
      <div className="assembly-note">
        <span>Гриф весит {barbell.shaftKg} кг</span>
        <span><Icon name="lock" size={14} /> Замки {collarCount}/2</span>
      </div>
      <SceneButton type="button" className="button primary assembly-check" onActivate={verify}>Проверить <Icon name="check" size={18} /></SceneButton>
      <SceneButton type="button" className="button quiet assembly-reset" onActivate={() => {
        if (submit({ kind: "reset-barbell" }).accepted) {
          setFeedback({ kind: "guide", message: "Диски снова в лотке. Можно попробовать другую сборку." });
          setResetCount((count) => count + 1);
        }
      }}><Icon name="rotate" size={17} /> Сбросить штангу</SceneButton>
    </div>
  );
}

type StorageSpot = Point & { size: number; anchor?: readonly [number, number]; angle?: number };
type StorageZone = Omit<Target, "id" | "label"> & {
  kind: "shelf" | "hook" | "peg";
  spots: readonly StorageSpot[];
  tag: Point & { text: string };
};

type RackFrame = { left: number; top: number; width: number; height: number };
const plateRack = { left: 5, top: 8, width: 35, height: 45.5 };
const storageRack = { left: 43, top: 8, width: 55, height: 45.5 };

function rackPoint(frame: RackFrame, x: number, y: number): Point {
  return { x: frame.left + frame.width * x, y: frame.top + frame.height * y };
}

function rackStyle(frame: RackFrame): CSSProperties {
  return { left: frame.left + "%", top: frame.top + "%", width: frame.width + "%", height: frame.height + "%" };
}

function shelf(level: number, text: string, size: number): StorageZone {
  const { x, y } = rackPoint(storageRack, .41, level);
  return {
    kind: "shelf", x, y: y - 2.7, width: 38, height: 10.8,
    tag: { x, y: y + 2.5, text },
    spots: [.25, .57].map((position) => ({
      ...rackPoint(storageRack, position, level), size, anchor: [50, 95],
    })),
  };
}

// Centers of the exposed pegs in the original 244 × 440 rack cutout.
const platePegs = [
  [70, 59, 12.8], [187, 27, 13.6],
  [70, 186, 14.2], [187, 149, 15],
  [70, 295, 15.8],
] as const;

const storage: Record<string, StorageZone> = {
  MATS: shelf(.314, "Коврики", 15.8),
  BLOCKS: shelf(.581, "Блоки", 14.6),
  ROLLERS: shelf(.852, "МФР-роллы", 15),
  BANDS: {
    kind: "hook", x: 92.2, y: 24.5, width: 14.8, height: 23,
    tag: { x: 92, y: 13.8, text: "Резинки" },
    spots: [.846, .957].map((position) => ({
      ...rackPoint(storageRack, position, .247), size: 4.7, anchor: [50, 8],
    })),
  },
  ...Object.fromEntries(inventoryPlateWeights.map((weight, index) => {
    const [x, y, size] = platePegs[index];
    const center = rackPoint(plateRack, x / 244, y / 440);
    return [plateRackSlot(weight), {
      kind: "peg", ...center, width: 16.4, height: 10.8,
      tag: { ...center, text: weight + " кг" }, spots: [{ ...center, size }],
    } satisfies StorageZone];
  })),
};

const looseInventory: Record<string, StorageSpot> = {
  MAT_1: { x: 13, y: 79.8, angle: -10, size: 20.2 },
  MAT_2: { x: 63, y: 92.9, angle: 8, size: 20.2 },
  BAND_1: { x: 63, y: 79.4, angle: -11, size: 19.4 },
  BAND_2: { x: 13, y: 92.6, angle: 7, size: 19.4 },
  BLOCK_1: { x: 38, y: 79.8, angle: 7, size: 19 },
  BLOCK_2: { x: 88, y: 92.8, angle: -8, size: 19 },
  ROLLER_1: { x: 88, y: 79.6, angle: 6, size: 19.4 },
  ROLLER_2: { x: 38, y: 92.7, angle: -8, size: 19.4 },
  ...Object.fromEntries(inventoryPlateWeights.map((weight, index) => [
    "PLATE_" + weight, { x: 11 + index * 19.5, y: 63.3, size: 15.2 + index * .52 },
  ])),
};

export function InventoryScene({ station, progress, submit }: Props & { station: Station }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  preload(asset("finish-medal"), { as: "image" });
  const assigned = progress.placements.INVENTORY;
  const zones = station.targets.map((target) => ({
    ...target, ...storage[target.id],
    items: Object.keys(assigned).filter((id) => assigned[id] === target.id),
  }));
  const stored = Object.values(assigned);
  const lastZone = stored.at(-1);
  const message = !lastZone ? stationDetails.INVENTORY.instruction
    : stored.length === station.items.length - 1 ? "На полу остался один предмет. Ещё немного, и проход свободен."
      : lastZone === "BANDS" ? "Резинка на крючке. Посмотри, что ещё осталось на полу."
        : lastZone.startsWith("PLATES_") ? "Диск на своём штыре. Остальные места тоже подписаны по весу."
          : "Предмет на месте. Что ещё осталось убрать?";
  const props = station.items.map<Prop>((item) => {
    const zone = zones.find((zone) => zone.id === assigned[item.id]);
    const position = zone ? zone.spots[zone.items.indexOf(item.id)] : looseInventory[item.id];
    return {
      ...position, id: item.id, label: item.label, location: zone?.id ?? floorId,
      src: zone?.kind === "hook" ? asset("inventory-band-hanging") : inventoryAsset(item),
      caption: !zone && item.weightKg !== undefined ? item.weightKg + " кг" : undefined,
      fitted: Boolean(zone), stationary: Boolean(zone),
    };
  });
  return (
    <div className="inventory-board">
      <CoachFeedback hint={feedback?.kind === "warning" ? feedback.message : null}
        message={feedback?.kind === "guide" ? feedback.message : message} />
      <InteractionField name="storage-floor" props={props} targets={zones} feedback={feedback} setFeedback={setFeedback} tapToPlace
        onDrop={(prop, destination) => submit({ kind: "place", stage: "INVENTORY", item: prop.id, destination })}>
        <img className="storage-rack plate-rack" style={rackStyle(plateRack)} src={asset("inventory-plate-rack")} draggable={false} alt="" />
        <img className="storage-rack supply-rack" style={rackStyle(storageRack)} src={asset("inventory-storage-rack")} draggable={false} alt="" />
        <span className="storage-rack-label" data-rack="plates">Диски</span>
        <span className="storage-rack-label" data-rack="shelves">Стеллаж</span>
        {zones.filter((zone) => zone.kind !== "peg" || zone.items.length === 0).map((zone) => (
          <span className="storage-slot-label" key={zone.id} data-kind={zone.kind} data-zone={zone.id}
            data-full={zone.items.length === zone.spots.length || undefined}
            style={{ left: zone.tag.x + "%", top: zone.tag.y + "%" }}>{zone.tag.text}</span>
        ))}
      </InteractionField>
    </div>
  );
}
