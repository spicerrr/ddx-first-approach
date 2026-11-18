import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createPortal, preload } from "react-dom";
import { barbellLayout, checkBarbell, type BarbellDestination } from "../engine/barbell";
import { inventoryPlacements, stationTotal, type Action, type Progress, type Result } from "../engine/game";
import { inventoryMilestone, inventoryRemaining } from "../engine/inventory";
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
type SpatialProps = Props & { station: Station; coach: Coach };
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
  mat?: boolean;
  mounted?: { slide: Point; clamp?: { height: number; closed: boolean } };
  dragSrc?: string;
  outermostId?: string;
};
type Target = Point & { id: string; label: string; width: number; height: number; kind?: string };
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
type Landing = { from: Point; destination: string };

function InteractionField({ name, props, targets, onDrop, onPick, tapToPlace = false, highlight, guideItem,
  verified, prompt, footer, children }: {
  name: string;
  props: readonly Prop[];
  targets: readonly Target[];
  onDrop: (prop: Prop, destination: string) => Result;
  onPick?: (item: string) => void;
  tapToPlace?: boolean;
  highlight?: string;
  guideItem?: string;
  verified?: boolean;
  prompt?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const field = useRef<HTMLDivElement>(null);
  const start = useRef<Held | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [landings, setLandings] = useState<Readonly<Record<string, Landing>>>({});
  const [returned, setReturned] = useState<string>();
  const [selected, setSelected] = useState<{ prop: Prop; keyboard: boolean } | null>(null);

  function scenePoint(point: Point): Point {
    const bounds = field.current!.getBoundingClientRect();
    return { x: (point.x - bounds.left) * 100 / bounds.width, y: (point.y - bounds.top) * 100 / bounds.height };
  }

  function targetAt(event: PointerEvent) {
    const { x, y } = scenePoint({ x: event.clientX, y: event.clientY });
    return targets.find((target) =>
      Math.abs(x - target.x) <= target.width / 2 && Math.abs(y - target.y) <= target.height / 2,
    )?.id;
  }

  function clearLanding(id: string) {
    setLandings((previous) => {
      if (!previous[id]) return previous;
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }

  function commit(prop: Prop, target: string, from: Point = prop) {
    const result = onDrop(prop, target);
    if (result.accepted) {
      setReturned(undefined);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setLandings((previous) => ({ ...previous, [prop.id]: { from, destination: target } }));
      }
      if (result.progress.phase === "playing" && target !== floorId) playFeedback(prop.cue, prop.pulse);
    } else {
      setReturned(prop.id);
    }
    return result;
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>, prop: Prop) {
    if (prop.stationary || !event.isPrimary || event.button !== 0 || start.current) return;
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
      clearLanding(held.prop.id);
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
    const from = scenePoint({ x: event.clientX - held.offset.x + held.width / 2, y: event.clientY });
    if (target && commit(held.prop, target, from).accepted) return;
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
  const guide = !floating && highlight ? targets.find(({ id }) => id === highlight) : undefined;
  const guidedProp = guide && props.find(({ id, stationary }) => id === guideItem && !stationary);
  const landedTargets = Object.values(landings).map(({ destination }) => destination);

  return <div className="station-arena" data-verified={verified || undefined}>
    <div className={"interaction-field " + name} ref={field}
      data-tap-ready={tapToPlace && Boolean(selected) || undefined}
      data-verified={verified || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") cancelSelection();
      }}>
      {children}
      {guide && guidedProp && <PlacementGuide from={guidedProp} to={guide} />}
      {props.map((prop) => {
        const landing = landings[prop.id];
        const landX = landing && field.current ? (landing.from.x - prop.x) * field.current.clientWidth / 100 : 0;
        const landY = landing && field.current ? (landing.from.y - prop.y) * field.current.clientHeight / 100 : 0;
        return (
          <div key={prop.id} className="scene-prop"
            role="img" aria-label={prop.label} aria-keyshortcuts={prop.stationary ? undefined : "Enter Space"}
            tabIndex={prop.stationary ? undefined : 0}
            data-scene-item={prop.id} data-location={prop.location} data-stationary={prop.stationary || undefined}
            data-held={floating?.prop.id === prop.id ? true : undefined}
            data-selected={selected?.prop.id === prop.id || undefined}
            data-guided={guidedProp?.id === prop.id || undefined}
            data-landed={Boolean(landing) || undefined}
            data-bumped={returned === prop.id || undefined}
            data-coaxial={Boolean(prop.mounted) || undefined}
            data-fitted={prop.fitted || undefined}
            data-clamp={Boolean(prop.mounted?.clamp) || undefined}
            data-mat={prop.mat || undefined}
            style={{
              left: (prop.x - (prop.mounted?.clamp ? prop.size * (prop.anchor?.[0] ?? 50) / 100 : 0)) + "%",
              top: (prop.y - (prop.mounted?.clamp ? prop.mounted.clamp.height * (prop.anchor?.[1] ?? 50) / 100 : 0)) + "%",
              width: prop.mounted || prop.fitted ? prop.size + "%" : "max(44px, " + prop.size + "%)",
              "--prop-x": -(prop.anchor?.[0] ?? 50) + "%", "--prop-y": -(prop.anchor?.[1] ?? 50) + "%",
              "--prop-angle": (prop.angle ?? 0) + "deg",
              "--slide-x": (prop.mounted?.slide.x ?? 0) + "%",
              "--slide-y": (prop.mounted?.slide.y ?? 0) + "%",
              "--land-x": landX + "px", "--land-y": landY + "px",
              "--clamp-art-layer": prop.mounted?.clamp ? prop.layer : undefined,
              zIndex: prop.mounted?.clamp ? undefined : prop.layer ?? 3,
            } as CSSProperties}
            onAnimationEnd={(event) => {
              if (["slide-on-bar", "fly-to-slot", "unroll-mat"].includes(event.animationName)) clearLanding(prop.id);
            }}
            onPointerDown={(event) => pointerDown(event, prop)}
            onPointerMove={pointerMove}
            onPointerUp={(event) => pointerEnd(event, false)}
            onPointerCancel={(event) => pointerEnd(event, true)}
            onLostPointerCapture={(event) => pointerEnd(event, true)}
            onKeyDown={(event) => {
              if (prop.stationary || (event.key !== " " && event.key !== "Enter")) return;
              event.preventDefault();
              select(prop, true);
            }}>
            {prop.mat ? <>
              <span className="mat-sheet" style={{ backgroundImage: `url(${prop.src})` }} />
              {landing && <img className="mat-flight" src={prop.dragSrc} alt="" draggable={false} />}
            </> : prop.mounted?.clamp ? (
              <div className="mounted-art">
                <span className="clamp-motion" data-closed={prop.mounted.clamp.closed} style={{ backgroundImage: `url(${asset("bar-clamp")})` }}>
                  <img className="clamp-sprite" src={prop.src} data-closed={prop.mounted.clamp.closed || undefined} alt="" draggable={false} />
                </span>
              </div>
            ) : <img className={prop.mounted ? "mounted-art" : undefined} src={prop.src} alt="" draggable={false} />}
            {prop.caption && <span className="scene-prop-caption" aria-hidden="true">{prop.caption}</span>}
          </div>
        );
      })}
      {targets.map((target) => (
        <div key={target.id} className="scene-drop" role="button" tabIndex={0} aria-label={target.label}
          data-scene-target={target.id}
          data-target-kind={target.kind}
          data-over={drag?.over === target.id || undefined}
          data-tip-target={highlight === target.id || undefined}
          data-settled={target.id !== floorId && landedTargets.includes(target.id) || undefined}
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
    {!verified && (prompt || selected) && <p className="interaction-cue" aria-live="polite">
      <span className="cue-icon"><Icon name={selected?.keyboard ? "keyboard" : "touch"} size={20} /></span>
      {selected?.keyboard ? "Выбери место клавишей Tab и нажми пробел."
        : selected ? "Коснись места, куда поставить предмет." : prompt}
    </p>}
    {footer}
  </div>;
}

function PlacementGuide({ from, to }: { from: Point; to: Point }) {
  const control = { x: from.x * .48 + to.x * .52, y: to.y + (from.y - to.y) * .22 };
  const angle = Math.atan2(to.y - control.y, to.x - control.x) * 180 / Math.PI;
  return <svg className="placement-guide" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path d={`M ${from.x} ${from.y - 5} Q ${control.x} ${control.y} ${to.x} ${to.y}`} />
    <path d="M 0 0 L -3.3 -2.1 L -2 0 L -3.3 2.1 Z" transform={`translate(${to.x} ${to.y}) rotate(${angle})`} />
  </svg>;
}

const dumbbellRack = { left: 2, top: 3, width: 96, height: 87.3 };
const rackedDumbbellScale = 1.15 * dumbbellRack.width / 100;
const rackPockets = rackRows.flatMap((weights, shelf) => weights.map((weight, pair) => {
  const [first, second] = rackArt.shelves[shelf].slice(pair * 2, pair * 2 + 2);
  const positions = [first, second].map(([x, y]) => rackPoint(dumbbellRack, x / 100, y / 100));
  const target = rackTargets.find((spot) => spot.weightKg === weight);
  return { weight, shelf, pair, positions, rest: positions[0].y, x: (positions[0].x + positions[1].x) / 2, target };
}));

const scatter = [
  { x: 16, y: 63, size: 23.5, angle: -10 },
  { x: 19.5, y: 81, size: 25, angle: 10 },
  { x: 49, y: 69.5, size: 25.5, angle: -8 },
  { x: 51, y: 89, size: 27.5, angle: 6 },
  { x: 81, y: 63.6, size: 26, angle: 2 },
  { x: 82, y: 82.8, size: 27, angle: -9 },
];

const rackDropTargets = [
  ...[...rackPockets].sort((a, b) => Number(Boolean(b.target)) - Number(Boolean(a.target))).map(({ target, x, rest, shelf, pair }) =>
    ({ id: target?.id ?? `OCCUPIED_${shelf}_${pair}`,
      label: target?.label ?? `${shelf === 0 ? "Верхняя" : "Нижняя"} полка, пара ${pair + 1} (занято)`,
      x, y: rest - 1.8, width: 19.65, height: 12.4, kind: "rack" })),
  { id: floorId, label: "На пол перед стойкой", x: 50, y: 77, width: 98, height: 45 },
];

function DumbbellScene({ station, progress, submit, coach }: SpatialProps) {
  const [picked, setPicked] = useState<string>();
  const assigned = progress.placements.DUMBBELLS;
  const needed = station.items.filter((item) => !assigned[item.id]);
  const hintItem = needed.find((item) => dumbbellRule(item.weightKg!).id === coach.active?.id)
    ?? needed.find((item) => item.id === picked) ?? needed[0];
  const rule = hintItem ? dumbbellRule(hintItem.weightKg!) : undefined;
  const props = station.items.map<Prop>((item, index) => {
    const spot = rackPockets.find((pocket) => pocket.target && pocket.target.id === assigned[item.id]);
    const pair = spot ? Object.keys(assigned).filter((id) => assigned[id] === spot.target?.id) : [];
    const art = rackArt.parts[String(item.weightKg) as keyof typeof rackArt.parts];
    const dragSrc = asset("dumbbell-floor-" + item.weightKg);
    const position = spot ? {
      ...spot.positions[pair.indexOf(item.id)],
      size: art.width * rackedDumbbellScale, anchor: [art.anchor[0], art.anchor[1]] as const,
    } : scatter[index];
    return {
      ...position, id: item.id, label: item.label, location: assigned[item.id] ?? floorId,
      src: spot ? asset("rack-dumbbell-" + item.weightKg) : dragSrc,
      dragSrc, cue: "dumbbell", fitted: Boolean(spot),
    };
  });

  function place(prop: Prop, destination: string) {
    const weight = station.items.find(({ id }) => id === prop.id)!.weightKg!;
    const result = submit({ kind: "place", stage: "DUMBBELLS", item: prop.id, destination });
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
      <CoachFeedback message={stationDetails.DUMBBELLS.instruction} line={coach.line}
        controls={<AssistControls coach={coach} rule={rule} example={hintItem && {
          item: asset("dumbbell-floor-" + hintItem.weightKg), destination: asset("dumbbell-rack-empty"),
        }} />} />
      <InteractionField name="gym-floor" props={props} targets={rackDropTargets} highlight={coach.line?.highlight} onDrop={place}
        guideItem={hintItem?.id} prompt="Перетащи гантель на свободное место."
        onPick={(item) => { setPicked(item); coach.act(); }} tapToPlace>
        <span className="gym-rack-shadow" aria-hidden="true" />
        <img className="scene-backdrop" style={rackStyle(dumbbellRack)} src={asset("dumbbell-rack-empty")} draggable={false}
          alt={rackRows.map((row, shelf) => {
            const fixed = row.filter((weightKg) => !rackTargets.some((slot) => slot.weightKg === weightKg));
            return `На ${shelf ? "нижней" : "верхней"} полке стоят пары ${fixed.join(", ")} кг.`;
          }).join(" ")} />
        {rackPockets.filter((pocket) => !pocket.target).flatMap(({ weight, positions }) => {
          const art = rackArt.parts[String(weight) as keyof typeof rackArt.parts];
          return positions.map((position) => (
            <img className="rack-fixed-dumbbell" key={weight + "-" + position.x} src={asset("rack-dumbbell-" + weight)} alt=""
              draggable={false} style={{ left: position.x + "%", top: position.y + "%", width: art.width * rackedDumbbellScale + "%",
                transform: `translate(${-art.anchor[0]}%, ${-art.anchor[1]}%)` }} />
          ));
        })}
        {rackPockets.map((pocket) => {
          const filled = pocket.target ? props.filter((prop) => prop.location === pocket.target?.id).length : 2;
          const highlighted = pocket.target?.id === coach.line?.highlight;
          return (
            <span className="rack-pair" data-shelf={pocket.shelf + 1} data-first-slot={pocket.pair * 2 + 1}
              data-paired={Boolean(pocket.target) && filled === 2 || undefined}
              data-vacant={filled < 2 || undefined} data-guided={Boolean(highlighted && coach.line?.highlight) || undefined}
              aria-hidden="true" key={pocket.weight} style={{ left: pocket.x + "%", top: pocket.rest + "%" }}>
              {[0, 1].map((index) => <i key={index} data-empty={index >= filled || undefined} />)}
            </span>
          );
        })}
      </InteractionField>
    </div>
  );
}

const shaftScale = 1.08;
const barbellTargets: readonly Target[] = [
  { id: "LEFT", label: "Левая втулка грифа", ...onShaft(-.83), width: 30, height: 36, kind: "sleeve" },
  { id: "RIGHT", label: "Правая втулка грифа", ...onShaft(.83), width: 30, height: 36, kind: "sleeve" },
  { id: floorId, label: "Место для дисков и замков на полу", x: 50, y: 77, width: 98, height: 46 },
];

const traySlots = [
  ["DISK_5_A", "DISK_5_B", "DISK_10_A", "DISK_20_A", "LOCK_A"],
  ["DISK_5_C", "DISK_5_D", "DISK_10_B", "DISK_20_B", "LOCK_B"],
] as const;
const traySpots = Object.fromEntries(traySlots.flatMap((row, y) =>
  row.map((id, x) => [id, { x: 12.4 + 18.8 * x, y: 65 + 22 * y }] as const),
));

const stockSize: Readonly<Record<number, number>> = { 5: 11.4, 10: 13, 20: 14.9 };
const diskDetails: Readonly<Record<number, { asset: keyof typeof barbellArt.parts; thickness: number; pulse: number | readonly number[] | undefined }>> = {
  5: { asset: "bar-disk-5", thickness: .029, pulse: undefined },
  10: { asset: "bar-disk-10", thickness: .045, pulse: 13 },
  20: { asset: "bar-disk-20", thickness: .065, pulse: [40, 16, 22] },
} as const;

function onShaft(axial: number, verified = false) {
  return { x: 50 + barbellArt.axis[0] * shaftScale * axial,
    y: (verified ? 45 : 27) + barbellArt.axis[1] * axial * (verified ? 1.84 : 1) };
}

function BarbellScene({ progress, submit, coach }: Props & { coach: Coach }) {
  const [resetCount, setResetCount] = useState(0);
  const assembly = progress.barbell;
  const layout = barbellLayout(assembly);
  const { totalKg, collarCount } = layout;
  const prompt = !layout.disksReady ? "Перетащи диски на гриф."
    : collarCount === barbell.closedCollars ? "Теперь можно проверить сборку." : "Закрепи диски замками.";
  const verified = progress.phase === "lesson";
  const check = checkBarbell(assembly);
  const rule = coach.active ?? (check.accepted ? {
    id: "barbell-verification",
    steps: ["Оба замка закрыты. Осталось проверить сборку.", "Внизу есть кнопка «Проверить».", "Нажми «Проверить»." ] as const,
  } : barbellRule(check.issue, layout));
  const mounts = new Map<string, { side: BarbellSide; axial: number; thickness: number }>();
  let diskHeight = 0;
  for (const side of barbellSides) {
    const sign = side === "LEFT" ? -1 : 1;
    let end = .662;
    for (const id of assembly.disks[side]) {
      const disk = barbell.props.find((prop) => prop.id === id);
      if (disk?.kind !== "disk") continue;
      const { thickness } = diskDetails[disk.weightKg];
      mounts.set(id, { side, axial: sign * (end + thickness / 2), thickness });
      diskHeight = Math.max(diskHeight, barbellArt.parts[diskDetails[disk.weightKg].asset].height);
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
    const position = onShaft(mount.axial, verified);
    return {
      ...position, id: prop.id, label: prop.label, src: asset(image), dragSrc, pulse, cue, location: mount.side,
      outermostId: disk && !assembly.collars[mount.side] ? assembly.disks[mount.side].at(-1) : undefined,
      layer: 90 + Math.round(mount.axial * 70), size: art.width * shaftScale, anchor: [art.anchor[0], art.anchor[1]],
      mounted: {
        slide: { x: (end.x - position.x) / art.width * 100, y: (end.y - position.y) / art.height * 100 },
        clamp: disk ? undefined : { height: art.height * (verified ? 1.84 : 1), closed },
      },
    };
  });

  function apply(input: Action) {
    const result = submit(input);
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
    if (mounted === barbell.closedCollars) resolved.push("barbell-missing-collar");
    if (next.collarCount === barbell.closedCollars) resolved.push("barbell-open-collar");
    if (input.kind === "toggle-collar" && !nextAssembly.locked[input.side]) resolved.push("barbell-locked-collar");
    if (input.kind === "move-barbell" && input.item.startsWith("LOCK_")) {
      resolved.push(input.destination === floorId ? "barbell-blocked-sleeve" : "barbell-occupied-collar");
    }
    if (input.kind === "move-barbell" && input.item.startsWith("DISK_") && input.destination === floorId) resolved.push("barbell-inner-disk");

    const message = input.kind === "check-barbell" ? "Вес поровну. Оба замка зафиксированы."
      : input.kind === "reset-barbell" ? "Гриф снова пустой. Диски и замки на полу."
        : next.collarCount === barbell.closedCollars ? "Оба замка защёлкнуты. Можно проверить сборку."
          : next.collarCount === 1 ? "Один замок закрыт. Остался второй."
            : mounted === barbell.closedCollars ? "Замки на месте. Осталось закрыть рычажки."
              : mounted === 1 ? "Один замок на месте. Остался второй."
                : next.disksReady ? "Вес собран. Осталось зафиксировать диски."
                  : totalKg === next.totalKg ? "Вес перераспределён. Сборку можно проверить."
                    : "Вес изменился. Сборку можно проверить.";
    coach.say(message, input.kind === "check-barbell" ? "success" : "task", resolved);
    return result;
  }

  const shaft = barbellArt.parts["bar-shaft"];
  const shadowTop = onShaft(0, verified).y + (verified ? 1.84 : 1) * (diskHeight / 2 - 1.4);
  return (
    <div className="barbell-board">
      <CoachFeedback message={stationDetails.BARBELL.instruction} line={coach.line}
        controls={<AssistControls coach={coach} rule={rule} example={rule.demo ? {
          item: asset(rule.id.includes("collar") || rule.id.endsWith("sleeve") ? "bar-tray-collar" : "bar-tray-20"),
          destination: asset("bar-shaft"),
        } : undefined} />} />
      <div className="barbell-mass" data-on-weight={totalKg === barbell.targetKg || undefined}>
        <div><span>Текущий вес</span><strong key={totalKg} data-current-weight={totalKg}
          data-verified={verified || undefined} aria-live="polite">{totalKg} кг</strong></div>
        <p>Цель <strong>{barbell.targetKg} кг</strong></p>
      </div>
      <InteractionField key={resetCount} name="barbell-table" props={verified ? props.filter((prop) => prop.location !== floorId) : props}
        targets={verified ? [] : barbellTargets} verified={verified} prompt={prompt}
        onPick={coach.act}
        onDrop={(prop, destination) => apply({ kind: "move-barbell", item: prop.id, destination: destination as BarbellDestination })}>
        <span className="barbell-shadow" style={{ top: shadowTop + "%" }} aria-hidden="true" />
        <img className="shaft-art" src={asset("bar-shaft")} alt="" draggable={false}
          style={{ left: onShaft(0).x + "%", top: onShaft(0, verified).y + "%", width: shaft.width * shaftScale + "%",
            transform: "translate(" + -shaft.anchor[0] + "%," + -shaft.anchor[1] + "%)" }} />
        {verified && <div className="barbell-balance"><Icon name="check" size={17} /> {layout.leftKg} / {layout.rightKg} кг</div>}
        {barbellSides.map((side) => {
          const id = assembly.collars[side];
          const mount = id ? mounts.get(id) : undefined;
          if (!mount) return null;
          const { x, y } = onShaft(mount.axial, verified);
          const closed = Boolean(assembly.locked[side]);
          const sideLabel = side === "LEFT" ? "левый" : "правый";
          return (
            <SceneButton key={side} type="button" className="barbell-latch-action" aria-pressed={closed}
              aria-label={(closed ? "Открыть " : "Защёлкнуть ") + sideLabel + " замок"}
              disabled={verified} style={{ left: x + "%", top: (y - (verified ? 23 : 13)) + "%" }}
              onActivate={() => { if (apply({ kind: "toggle-collar", side }).accepted) playFeedback("collar"); }}>
              <span><Icon name={closed ? "lock" : "unlock"} size={14} /></span>
            </SceneButton>
          );
        })}
      </InteractionField>
      {!verified && <>
        <div className="assembly-note">
          <span>Гриф весит {barbell.shaftKg} кг</span>
          {Object.keys(assembly.collars).length > 0 && <span><Icon name="lock" size={14} /> Замки {collarCount}/{barbell.closedCollars}</span>}
        </div>
        <div className="assembly-actions">
          <SceneButton type="button" className="button primary assembly-check" onActivate={() => apply({ kind: "check-barbell" })}>
            Проверить <Icon name="check" size={19} />
          </SceneButton>
          <SceneButton type="button" className="button ghost assembly-reset" aria-label="Сбросить штангу" onActivate={() => {
            if (apply({ kind: "reset-barbell" }).accepted) setResetCount((count) => count + 1);
          }}><Icon name="rotate" size={20} /></SceneButton>
        </div>
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
const plateRack = { left: 4.5, top: 5, width: 35.3, height: 50 };
const storageRack = { left: 41, top: 5, width: 57.5, height: 50 };

function rackPoint(frame: RackFrame, x: number, y: number): Point {
  return { x: frame.left + frame.width * x, y: frame.top + frame.height * y };
}

function rackStyle(frame: RackFrame): CSSProperties {
  return { left: frame.left + "%", top: frame.top + "%", width: frame.width + "%", height: frame.height + "%" };
}

function shelf(level: number, text: string, size: number, stack = false): StorageZone {
  const { x, y } = rackPoint(storageRack, .41, level);
  return {
    kind: "shelf", x, y: y - 3.3, width: 39, height: 11.8,
    tag: { x, y: y + 2.35, text },
    spots: stack ? [0, 1].map((layer) => ({ x, y: y - .42 - layer * 1.13, size, anchor: [50, 83] }))
      : [.25, .57].map((position) => ({ ...rackPoint(storageRack, position, level), size, anchor: [50, 95] })),
  };
}

// Centers of the exposed pegs in the original 244 × 440 rack cutout.
const platePegs = [
  [70, 59, 13.5], [187, 27, 14.3],
  [70, 186, 15], [187, 149, 15.8],
  [70, 295, 16.4],
] as const;

const storage: Record<string, StorageZone> = {
  MATS: shelf(.852, shelfLabels.MATS, 41.5, true),
  BLOCKS: shelf(.581, shelfLabels.BLOCKS, 15.4),
  ROLLERS: shelf(.314, shelfLabels.ROLLERS, 15.7),
  BANDS: {
    kind: "hook", x: 93, y: 21, width: 13.4, height: 15,
    tag: { x: 92.1, y: 11.9, text: shelfLabels.BANDS },
    spots: [.846, .957].map((position) => ({
      ...rackPoint(storageRack, position, .247), size: 5.5, anchor: [50, 8],
    })),
  },
  ...Object.fromEntries(inventoryPlateWeights.map((weight, index) => {
    const [x, y, size] = platePegs[index];
    const center = rackPoint(plateRack, x / 244, y / 440);
    return [plateRackSlot(weight), {
      kind: "peg", ...center, width: 16.4, height: 11.9,
      tag: { x: center.x, y: Math.max(2.3, center.y - 6.9), text: weight + " кг" }, spots: [{ ...center, size }],
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
    "PLATE_" + weight, { x: 11 + index * 19.5, y: 63.5, size: 16.5 + index * .42 },
  ])),
};

function InventoryScene({ station, progress, submit, coach }: SpatialProps) {
  const [picked, setPicked] = useState<string>();
  preload(asset("finish-medal"), { as: "image" });
  const assigned = inventoryPlacements(progress);
  const zones = station.targets.map((target) => ({
    ...target, ...storage[target.id],
    items: Object.keys(assigned).filter((id) => assigned[id] === target.id),
  }));
  const remaining = inventoryRemaining(assigned);
  const pickedItem = remaining.loose.find((item) => item.id === picked);
  const guidedItem = pickedItem?.targetId === coach.line?.highlight ? pickedItem
    : remaining.loose.find((item) => item.targetId === coach.line?.highlight);
  const hintItem = pickedItem ?? guidedItem
    ?? remaining.loose.find((item) => item.targetId === coach.active?.highlight) ?? remaining.loose[0];
  const props = station.items.map<Prop>((item) => {
    const zone = zones.find((zone) => zone.id === assigned[item.id]);
    const order = zone?.items.indexOf(item.id) ?? 0;
    const position = zone ? zone.spots[order] : looseInventory[item.id];
    const floorAsset = inventoryAsset(item);
    const mat = zone?.id === "MATS";
    let src = floorAsset;
    if (mat) src = asset(item.id === "MAT_2" ? "mat-unroll-teal" : "mat-unroll-coral");
    if (zone?.kind === "hook") src = asset(item.id === "BAND_2" ? "inventory-band-hanging-coral" : "inventory-band-hanging");
    return {
      ...position, id: item.id, label: item.label, location: zone?.id ?? floorId,
      src, mat, dragSrc: floorAsset, layer: mat ? 5 + order : zone ? 4 : 3,
      caption: !zone && item.weightKg !== undefined ? item.weightKg + " кг" : undefined,
      cue: item.weightKg === undefined ? "storage" : "plate", fitted: Boolean(zone), stationary: Boolean(zone),
    };
  });

  function place(prop: Prop, destination: string) {
    const item = station.items.find(({ id }) => id === prop.id)!;
    const result = submit({ kind: "place", stage: "INVENTORY", item: prop.id, destination });
    const rule = inventoryRule(item);
    if (!result.accepted) {
      coach.mistake(rule);
      return result;
    }
    const remaining = inventoryRemaining(inventoryPlacements(result.progress));
    const milestone = inventoryMilestone(item, remaining, Object.keys(result.progress.placements.INVENTORY).length);
    if (milestone || coach.line?.tone === "hint") {
      coach.say(milestone ?? "Предмет на месте. Какие ещё остались на полу?", "success", [rule.id]);
    } else {
      coach.resolve([rule.id]);
    }
    return result;
  }

  return (
    <div className="inventory-board">
      <CoachFeedback message={`В зоне осталось убрать ${stationTotal(station)} предметов. Верни их на места.`} line={coach.line}
        controls={<AssistControls coach={coach} rule={hintItem && inventoryRule(hintItem)} example={hintItem && {
          item: inventoryAsset(hintItem), destination: asset(hintItem.weightKg ? "inventory-plate-rack" : "inventory-storage-rack"),
        }} />} />
      <InteractionField name="storage-floor" props={props} targets={zones} highlight={guidedItem?.targetId}
        guideItem={guidedItem?.id} tapToPlace onDrop={place} onPick={(item) => { setPicked(item); coach.act(); }}
        footer={<div className="inventory-progress" aria-live="polite">
          <InventoryMeter icon="disc" label="Диски" remaining={remaining.plates} />
          <InventoryMeter icon="cube" label="Инвентарь" remaining={remaining.supplies} />
        </div>}>
        <span className="supply-rack-shadow" aria-hidden="true" />
        <img className="storage-rack plate-rack" style={rackStyle(plateRack)} src={asset("inventory-plate-rack")} draggable={false} alt="" />
        <img className="storage-rack supply-rack" style={rackStyle(storageRack)} src={asset("inventory-storage-rack")} draggable={false} alt="" />
        {zones.map((zone) => {
          const full = zone.items.length === zone.spots.length;
          return <div key={zone.id} className="storage-slot" aria-hidden="true">
            {zone.kind === "shelf" && <span className="shelf-light" data-full={full || undefined}
              style={{ left: zone.x + "%", top: (zone.y + 2.5) + "%" }} />}
            <span className="storage-slot-label" data-kind={zone.kind} data-zone={zone.id} data-full={full || undefined}
              style={{ left: zone.tag.x + "%", top: zone.tag.y + "%" }}>{zone.tag.text}</span>
          </div>;
        })}
      </InteractionField>
    </div>
  );
}

function InventoryMeter({ icon, label, remaining }: { icon: "disc" | "cube"; label: string; remaining: number }) {
  return <p className="inventory-meter">
    <Icon name={icon} size={19} />
    <span>{label} · осталось <strong>{remaining}</strong></span>
  </p>;
}

export function SpatialStation(props: SpatialProps) {
  if (props.station.stage === "DUMBBELLS") return <DumbbellScene {...props} />;
  if (props.station.stage === "BARBELL") return <BarbellScene {...props} />;
  return <InventoryScene {...props} />;
}
