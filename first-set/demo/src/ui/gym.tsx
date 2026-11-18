import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createPortal, preload } from "react-dom";
import { barbellLayout, checkBarbell, type BarbellDestination } from "../engine/barbell";
import type { Action, Progress, Result } from "../engine/game";
import { barbell, barbellSides, floorId, inventoryPlateWeights, plateRackSlot, rackRows, rackTargets, stationDetails, type BarbellSide, type Station } from "../engine/scenario";
import { barbellRule, dumbbellRule, inventoryRule, shelfLabels } from "../engine/station-hints";
import { asset, Icon, inventoryAsset } from "./graphics";
import { SceneButton } from "./scene-button";
import { CoachFeedback } from "./coach-message";
import { AssistControls } from "./station-help";
import { playFeedback, type Cue } from "./feedback";
import type { Coach } from "./use-coach";
import barbellArt from "./barbell-art.json";
import rackArt from "./rack-art.json";

type Submit = (action: Action) => Result;
type Props = { progress: Progress; submit: Submit };
type SpatialProps = Props & { station: Station; coach?: Coach; goal?: number };
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
  cue: Cue;
  fitted?: boolean;
  mounted?: { slide: Point; clamp?: { height: number; closed: boolean } };
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
type Retreat = Drag & { dx: number; dy: number };

function InteractionField({ name, props, targets, onDrop, onPick, tapToPlace = false, highlight, verified, assisted = true, children }: {
  name: string;
  props: readonly Prop[];
  targets: readonly Target[];
  onDrop: (prop: Prop, destination: string) => Result;
  onPick?: (item: string) => void;
  tapToPlace?: boolean;
  highlight?: string;
  verified?: boolean;
  assisted?: boolean;
  children: ReactNode;
}) {
  const field = useRef<HTMLDivElement>(null);
  const start = useRef<Held | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [landed, setLanded] = useState<readonly string[]>([]);
  const [returned, setReturned] = useState<string>();
  const [selected, setSelected] = useState<{ prop: Prop; keyboard: boolean } | null>(null);

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
      setReturned(undefined);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setLanded((ids) => ids.includes(prop.id) ? ids : [...ids, prop.id]);
      }
      if (result.progress.phase !== "lesson" && target !== floorId) playFeedback(prop.cue, prop.pulse);
    } else {
      setReturned(prop.id);
    }
    return result;
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>, prop: Prop) {
    if (!event.isPrimary || event.button !== 0 || start.current) return;
    const picked = props.find((item) => item.id === prop.outermostId) ?? prop;
    onPick?.(picked.id);
    setReturned(undefined);
    setRetreat(null);
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
      if (tapToPlace && selected?.prop.id === held.prop.id) cancelSelection();
      else if (tapToPlace) select(held.prop, false);
      return;
    }
    const target = targetAt(event);
    if (target && commit(held.prop, target).accepted) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const source = field.current?.querySelector('[data-scene-item="' + held.prop.id + '"]')?.getBoundingClientRect();
    if (!source) return;
    const x = event.clientX - held.offset.x, y = event.clientY - held.offset.y;
    setRetreat({ prop: held.prop, width: held.width, x, y, dx: source.left - x, dy: source.top - y });
  }

  function focusProp(prop: Prop) {
    field.current?.querySelector<HTMLElement>('[data-scene-item="' + prop.id + '"]')?.focus({ preventScroll: true });
  }

  function select(prop: Prop, usingKeyboard: boolean) {
    if (usingKeyboard) onPick?.(prop.id);
    setSelected({ prop, keyboard: usingKeyboard });
    if (usingKeyboard) {
      field.current?.querySelector<HTMLElement>("[data-scene-target]")?.focus({ preventScroll: true });
    }
  }

  function cancelSelection() {
    if (!selected) return;
    focusProp(selected.prop);
    setSelected(null);
  }

  function placeSelected(target: string) {
    if (selected && commit(selected.prop, target).accepted) {
      focusProp(selected.prop);
      setSelected(null);
    }
  }

  const floating = drag ?? retreat;
  return <>
    <div className={"interaction-field " + name} ref={field}
      data-tap-ready={tapToPlace && Boolean(selected) || undefined}
      data-unassisted={!assisted || undefined}
      data-verified={verified || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") cancelSelection();
      }}>
      {children}
      {props.map((prop) => (
        <div key={prop.id} className="scene-prop"
          role="img" aria-label={prop.label} aria-keyshortcuts={prop.stationary ? undefined : "Enter Space"}
          tabIndex={prop.stationary ? undefined : 0}
          data-scene-item={prop.id} data-location={prop.location} data-stationary={prop.stationary || undefined}
          data-held={floating?.prop.id === prop.id ? true : undefined}
          data-selected={selected?.prop.id === prop.id || undefined}
          data-landed={landed.includes(prop.id) || undefined}
          data-bumped={returned === prop.id || undefined}
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
              <img className="clamp-sprite" data-closed={prop.mounted.clamp.closed || undefined} src={prop.src} alt="" draggable={false} />
            </div>
          ) : <img className={prop.mounted ? "mounted-art" : undefined} src={prop.src} alt="" draggable={false} />}
          {prop.caption && <span className="scene-prop-caption" aria-hidden="true">{prop.caption}</span>}
        </div>
      ))}
      {targets.map((target) => (
        <div key={target.id} className="scene-drop" role="button" tabIndex={0} aria-label={target.label}
          data-scene-target={target.id}
          data-over={assisted && drag?.over === target.id || undefined}
          data-tip-target={highlight === target.id || undefined}
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
      {floating && createPortal(
        <img className="scene-carried" data-returning={Boolean(retreat) || undefined}
          src={floating.prop.dragSrc ?? floating.prop.src} alt="" draggable={false} onAnimationEnd={() => setRetreat(null)}
          style={{ left: floating.x, top: floating.y, width: floating.width, rotate: (floating.prop.angle ?? 0) + "deg",
            "--return-x": (retreat?.dx ?? 0) + "px", "--return-y": (retreat?.dy ?? 0) + "px" } as CSSProperties} />,
        document.body,
      )}
    </div>
    {assisted && !verified && <p className="interaction-cue" aria-live="polite">
      <Icon name="info" size={15} />
      {selected?.keyboard ? "Выбери место клавишей Tab и нажми пробел."
        : selected ? "Коснись места, куда поставить предмет." : "Перетащи предмет на нужное место."}
    </p>}
  </>;
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
  ...[...rackPockets].sort((a, b) => Number(Boolean(b.target)) - Number(Boolean(a.target))).map(({ target, x, rest, shelf, pair }) =>
    ({ id: target?.id ?? `OCCUPIED_${shelf}_${pair}`,
      label: target?.label ?? `${shelf === 0 ? "Верхняя" : "Нижняя"} полка, пара ${pair + 1} (занято)`,
      x, y: rest - 2.2, width: 19.7, height: 14.8 })),
  { id: floorId, label: "На пол перед стойкой", x: 50, y: 79, width: 97, height: 42 },
];

export function DumbbellScene({ station, progress, submit, coach }: Props & { station: Station; coach?: Coach }) {
  const [picked, setPicked] = useState<string>();
  const assigned = progress.placements.DUMBBELLS;
  const needed = station.items.filter((item) => !assigned[item.id]);
  const hintItem = needed.find((item) => dumbbellRule(item.weightKg!).id === coach?.active?.id)
    ?? needed.find((item) => item.id === picked) ?? needed[0];
  const rule = hintItem ? dumbbellRule(hintItem.weightKg!) : undefined;
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
      dragSrc, cue: "dumbbell", fitted: Boolean(spot), stationary: !coach && Boolean(spot),
    };
  });

  function place(prop: Prop, destination: string) {
    const weight = station.items.find(({ id }) => id === prop.id)!.weightKg!;
    const result = submit({ kind: "place", stage: "DUMBBELLS", item: prop.id, destination });
    if (!coach) return result;
    const rule = dumbbellRule(weight);
    if (!result.accepted) {
      if (prop.location !== destination && destination !== floorId) coach.mistake(rule);
      return result;
    }
    if (destination === floorId) {
      coach.say("Гантель снова на полу. Найди ей место на стойке.");
      return result;
    }
    const fitted = Object.values(result.progress.placements.DUMBBELLS).filter((target) => target === destination).length;
    coach.say(fitted === 2 ? `Пара ${weight} кг на месте.` : `Одна гантель ${weight} кг уже на месте. Найди ей пару.`,
      "success", [rule.id]);
    return result;
  }

  return (
    <div className="dumbbell-board">
      {coach && <CoachFeedback message={stationDetails.DUMBBELLS.instruction} line={coach.line}
        controls={<AssistControls coach={coach} rule={rule} example={hintItem && {
          item: asset("dumbbell-floor-" + hintItem.weightKg), destination: asset("dumbbell-rack-empty"),
        }} />} />}
      <InteractionField name="gym-floor" props={props} targets={rackDropTargets} highlight={coach?.line?.highlight} onDrop={place}
        onPick={coach ? (item) => { setPicked(item); coach.act(); } : undefined} tapToPlace assisted={Boolean(coach)}>
        <img className="scene-backdrop" src={asset("dumbbell-rack-empty")} draggable={false}
          alt="На верхней полке стоят пары 2, 4 и 6 кг. На нижней стоят пары 10 и 14 кг." />
        {rackPockets.filter((pocket) => !pocket.target).flatMap(({ weight, positions, rest }) => {
          const art = rackArt.parts[weight];
          return positions.map((position) => (
            <img className="rack-fixed-dumbbell" key={weight + "-" + position} src={asset("rack-dumbbell-" + weight)} alt=""
              draggable={false} style={{ left: position + "%", top: rest + "%", width: art.width + "%",
                transform: `translate(${-art.anchor[0]}%, ${-art.anchor[1]}%)` }} />
          ));
        })}
        {rackPockets.map((pocket) => {
          const paired = pocket.target && props.filter((prop) => prop.location === pocket.target?.id).length === 2;
          return (
            <span className="rack-pair" data-shelf={pocket.shelf + 1} data-first-slot={pocket.pair * 2 + 1}
              data-paired={Boolean(coach) && paired || undefined} data-vacant={Boolean(pocket.target) && !paired || undefined} aria-hidden="true" key={pocket.weight}
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

export function BarbellScene({ progress, submit, coach, goal = barbell.targetKg }: Props & { coach?: Coach; goal?: number }) {
  const [resetCount, setResetCount] = useState(0);
  const assembly = progress.barbell;
  const layout = barbellLayout(assembly, goal);
  const { totalKg, collarCount, disksReady } = layout;
  const verified = progress.phase === "lesson";
  const check = checkBarbell(assembly, goal);
  const rule = coach?.active ?? (check.accepted ? {
    id: "barbell-verification",
    steps: ["Оба замка закрыты. Осталось проверить сборку.", "Внизу есть кнопка «Проверить».", "Нажми «Проверить»." ] as const,
  } : barbellRule(check.issue, layout));
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
    const cue = disk ? "plate" : "collar";
    if (!mount) return {
      ...traySpots[prop.id], id: prop.id, label: prop.label, src: dragSrc, pulse, cue, location: floorId,
      size: disk ? stockSize[disk.weightKg] : 10.7,
    };
    const name = details?.asset ?? "bar-clamp";
    const art = barbellArt.parts[name];
    const closed = Boolean(assembly.locked[mount.side]);
    const image = disk ? name : closed ? "bar-clamp-closed" : "bar-clamp-open";
    const end = onShaft(Math.sign(mount.axial) * (1.105 + mount.thickness / 2));
    const position = onShaft(mount.axial);
    if (verified) position.y += 13;
    return {
      ...position, id: prop.id, label: prop.label, src: asset(image), dragSrc, pulse, cue, location: mount.side,
      outermostId: disk && !assembly.collars[mount.side] ? assembly.disks[mount.side].at(-1) : undefined,
      layer: 90 + Math.round(mount.axial * 70), size: art.width, anchor: [art.anchor[0], art.anchor[1]],
      mounted: {
        slide: { x: (end.x - position.x) / art.width * 100, y: (end.y - position.y) / art.height * 100 },
        clamp: disk ? undefined : { height: art.height, closed },
      },
    };
  });

  function apply(input: Action) {
    const result = submit(input);
    if (!coach) return result;
    if (!result.accepted) {
      if (result.issue) coach.mistake(barbellRule(result.issue, layout));
      return result;
    }

    const nextAssembly = result.progress.barbell;
    const next = barbellLayout(nextAssembly);
    const mounted = Object.keys(nextAssembly.collars).length;
    const resolved: string[] = [];
    if (next.totalKg >= barbell.targetKg) resolved.push("barbell-mass-under");
    if (next.totalKg <= barbell.targetKg) resolved.push("barbell-mass-over");
    if (next.symmetric) resolved.push("barbell-imbalanced");
    if (next.disksReady) resolved.push("barbell-early-collar");
    if (mounted === 2) resolved.push("barbell-missing-collar");
    if (next.collarCount === 2) resolved.push("barbell-open-collar");
    if (input.kind === "toggle-collar" && !nextAssembly.locked[input.side]) resolved.push("barbell-locked-collar");
    if (input.kind === "move-barbell" && input.item.startsWith("LOCK_")) {
      resolved.push(input.destination === floorId ? "barbell-blocked-sleeve" : "barbell-occupied-collar");
    }
    if (input.kind === "move-barbell" && input.item.startsWith("DISK_") && input.destination === floorId) resolved.push("barbell-inner-disk");

    const message = input.kind === "check-barbell" ? "Вес поровну. Оба замка зафиксированы."
      : input.kind === "reset-barbell" ? "Гриф снова пустой. Диски и замки в лотке."
        : next.collarCount === 2 ? "Оба замка защёлкнуты. Можно проверить сборку."
          : next.collarCount === 1 ? "Один замок закрыт. Остался второй."
            : mounted === 2 ? "Замки на месте. Осталось закрыть рычажки."
              : mounted === 1 ? "Один замок на месте. Остался второй."
                : next.disksReady ? "Вес собран. Осталось зафиксировать диски."
                  : totalKg === next.totalKg ? "Вес перераспределён. Сборку можно проверить."
                    : "Вес изменился. Сборку можно проверить.";
    coach.say(message, input.kind === "check-barbell" ? "success" : "task", resolved);
    return result;
  }

  const shaft = barbellArt.parts["bar-shaft"];
  return (
    <div className="barbell-board">
      {coach && <CoachFeedback message={stationDetails.BARBELL.instruction} line={coach.line}
        controls={<AssistControls coach={coach} rule={rule} example={rule.demo ? {
          item: asset(rule.id.includes("collar") || rule.id.endsWith("sleeve") ? "bar-tray-collar" : "bar-tray-20"),
          destination: asset("bar-shaft"),
        } : undefined} />} />}
      <div className="barbell-mass">
        <div><span>Текущий вес</span><strong key={totalKg} data-current-weight={totalKg}
          data-verified={verified || undefined} aria-live="polite">{totalKg} кг</strong></div>
        <p>Цель <strong>{goal} кг</strong></p>
      </div>
      <InteractionField key={resetCount} name="barbell-table" props={verified ? props.filter((prop) => prop.location !== floorId) : props}
        targets={verified ? [] : barbellTargets} verified={verified} assisted={Boolean(coach)}
        onPick={coach?.act}
        onDrop={(prop, destination) => apply({ kind: "move-barbell", item: prop.id, destination: destination as BarbellDestination })}>
        <span className="barbell-shadow" aria-hidden="true" />
        <img className="shaft-art" src={asset("bar-shaft")} alt="" draggable={false}
          style={{ left: onShaft(0).x + "%", top: (onShaft(0).y + (verified ? 13 : 0)) + "%", width: shaft.width + "%",
            transform: "translate(" + -shaft.anchor[0] + "%," + -shaft.anchor[1] + "%)" }} />
        {verified
          ? <div className="barbell-balance"><Icon name="check" size={17} /> {layout.leftKg} / {layout.rightKg} кг</div>
          : <div className="barbell-tray" aria-hidden="true">
            {["5 кг", "10 кг", "20 кг", "Замки"].map((label, index) =>
              <span key={label} data-next={index === 3 && disksReady && coach?.active?.id === "barbell-missing-collar"
                && (coach.line?.level ?? 0) >= 3 || undefined}>{label}</span>)}
          </div>}
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
              disabled={verified} style={{ left: x + "%", top: (y - 12.5 + (verified ? 13 : 0)) + "%" }}
              onActivate={() => { if (apply({ kind: "toggle-collar", side }).accepted) playFeedback("collar"); }}>
              <span><Icon name={closed ? "lock" : "unlock"} size={14} /></span>
            </SceneButton>
          );
        })}
      </InteractionField>
      {!verified && <>
        <div className="assembly-note">
          <span>Гриф весит {barbell.shaftKg} кг</span>
          {Object.keys(assembly.collars).length > 0 && <span><Icon name="lock" size={14} /> Замки {collarCount}/2</span>}
        </div>
        <SceneButton type="button" className="button primary assembly-check" onActivate={() => apply({ kind: "check-barbell" })}>
          Проверить <Icon name="check" size={18} />
        </SceneButton>
        <SceneButton type="button" className="button quiet assembly-reset" onActivate={() => {
          if (apply({ kind: "reset-barbell" }).accepted) setResetCount((count) => count + 1);
        }}><Icon name="rotate" size={17} /> Сбросить штангу</SceneButton>
      </>}
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
    tag: { x, y: y + .8, text },
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
  MATS: shelf(.314, shelfLabels.MATS, 15.8),
  BLOCKS: shelf(.581, shelfLabels.BLOCKS, 14.6),
  ROLLERS: shelf(.852, shelfLabels.ROLLERS, 15),
  BANDS: {
    kind: "hook", x: 92.2, y: 24.5, width: 14.8, height: 23,
    tag: { x: 92, y: 16.1, text: shelfLabels.BANDS },
    spots: [.846, .957].map((position) => ({
      ...rackPoint(storageRack, position, .247), size: 4.7, anchor: [50, 8],
    })),
  },
  ...Object.fromEntries(inventoryPlateWeights.map((weight, index) => {
    const [x, y, size] = platePegs[index];
    const center = rackPoint(plateRack, x / 244, y / 440);
    return [plateRackSlot(weight), {
      kind: "peg", ...center, width: 16.4, height: 10.8,
      tag: { x: center.x, y: center.y + 5.6, text: weight + " кг" }, spots: [{ ...center, size }],
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

const shelfMilestones: Partial<Record<string, string>> = {
  MATS: "Коврики на месте.", BLOCKS: "Блоки на месте.", ROLLERS: "МФР-роллы на месте.", BANDS: "Резинки на месте.",
};

export function InventoryScene({ station, progress, submit, coach }: Props & { station: Station; coach?: Coach }) {
  const [picked, setPicked] = useState<string>();
  preload(asset("finish-medal"), { as: "image" });
  const assigned = progress.placements.INVENTORY;
  const zones = station.targets.map((target) => ({
    ...target, ...storage[target.id],
    items: Object.keys(assigned).filter((id) => assigned[id] === target.id),
  }));
  const stored = Object.keys(assigned);
  const plates = stored.filter((id) => id.startsWith("PLATE_")).length;
  const needed = station.items.filter((item) => !assigned[item.id]);
  const hintItem = needed.find((item) => inventoryRule(item).id === coach?.active?.id)
    ?? needed.find((item) => item.id === picked) ?? needed[0];
  const props = station.items.map<Prop>((item) => {
    const zone = zones.find((zone) => zone.id === assigned[item.id]);
    const position = zone ? zone.spots[zone.items.indexOf(item.id)] : looseInventory[item.id];
    return {
      ...position, id: item.id, label: item.label, location: zone?.id ?? floorId,
      src: zone?.kind === "hook" ? asset(item.id === "BAND_2" ? "inventory-band-hanging-coral" : "inventory-band-hanging") : inventoryAsset(item),
      caption: !zone && item.weightKg !== undefined ? item.weightKg + " кг" : undefined,
      cue: item.weightKg === undefined ? "storage" : "plate", fitted: Boolean(zone), stationary: Boolean(zone),
    };
  });

  function place(prop: Prop, destination: string) {
    const item = station.items.find(({ id }) => id === prop.id)!;
    const result = submit({ kind: "place", stage: "INVENTORY", item: prop.id, destination });
    if (!coach) return result;
    const rule = inventoryRule(item);
    if (!result.accepted) {
      coach.mistake(rule);
      return result;
    }
    const next = Object.values(result.progress.placements.INVENTORY);
    const shelfFull = next.filter((slot) => slot === destination).length === 2;
    const milestone = next.length === station.items.length ? "Все предметы на месте."
      : next.length === 1 ? "Да. Дальше можно ориентироваться по подписям на стойках."
        : item.weightKg !== undefined && plates + 1 === inventoryPlateWeights.length ? "Все диски на стойке."
          : shelfFull ? shelfMilestones[destination]
            : undefined;
    if (milestone || coach.line?.tone === "hint") {
      coach.say(milestone ?? "Предмет на месте. Какие ещё остались на полу?", "success", [rule.id]);
    } else {
      coach.resolve([rule.id]);
    }
    return result;
  }

  return (
    <div className="inventory-board">
      {coach && <CoachFeedback message={stationDetails.INVENTORY.instruction} line={coach.line}
        controls={<AssistControls coach={coach} rule={hintItem && inventoryRule(hintItem)} example={hintItem && {
          item: inventoryAsset(hintItem), destination: asset(hintItem.weightKg ? "inventory-plate-rack" : "inventory-storage-rack"),
        }} />} />}
      <InteractionField name="storage-floor" props={props} targets={zones} highlight={coach?.line?.highlight} assisted={Boolean(coach)}
        tapToPlace onDrop={place} onPick={coach ? (item) => { setPicked(item); coach.act(); } : undefined}>
        <img className="storage-rack plate-rack" style={rackStyle(plateRack)} src={asset("inventory-plate-rack")} draggable={false} alt="" />
        <img className="storage-rack supply-rack" style={rackStyle(storageRack)} src={asset("inventory-storage-rack")} draggable={false} alt="" />
        {zones.map((zone) => (
          <span className="storage-slot-label" key={zone.id} data-kind={zone.kind} data-zone={zone.id}
            data-full={zone.items.length === zone.spots.length || undefined}
            style={{ left: zone.tag.x + "%", top: zone.tag.y + "%" }}>{zone.tag.text}</span>
        ))}
      </InteractionField>
      {coach && <div className="inventory-progress" aria-live="polite">
        <p><Icon name="gym" size={16} /> Диски <strong>{plates} / {inventoryPlateWeights.length}</strong></p>
        <p><Icon name="storage" size={16} /> Инвентарь <strong>{stored.length - plates} / {station.items.length - inventoryPlateWeights.length}</strong></p>
      </div>}
    </div>
  );
}

export function SpatialStation(props: SpatialProps) {
  if (props.station.stage === "DUMBBELLS") return <DumbbellScene {...props} />;
  if (props.station.stage === "BARBELL") return <BarbellScene {...props} />;
  return <InventoryScene {...props} />;
}
