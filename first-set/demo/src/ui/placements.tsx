import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { barbellLayout } from "../engine/barbell";
import type { Action, Progress, Result } from "../engine/game";
import { barbell, initialDumbbell, type Destination, type Item, type PlacementStation, type Station } from "../engine/scenario";
import { Equipment, Icon, ItemArt, type ArtName } from "./graphics";

type PlacementConfig = Station & { stage: PlacementStation };
type PlacementProps = {
  station: PlacementConfig;
  progress: Progress;
  submit: (action: Action) => Result;
};
type PointerStart = { pointerId: number; item: Item; x: number; y: number; moved: boolean };
type Drag = { item: Item; x: number; y: number; over?: string };

const zoneArt: Record<string, ArtName> = {
  MATS: "mat",
  BANDS: "band",
  BLOCKS: "block",
  ROLLERS: "roller",
};

function hitTarget(event: PointerEvent) {
  return document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-drop]")?.dataset.drop;
}

function shortLabel(station: PlacementStation, item: Item) {
  if (station === "DUMBBELLS") return `${item.weightKg} кг`;
  if (station === "BARBELL") return item.label.replace("Диск ", "");
  return item.label.replace(/ 0([12])$/, " $1");
}

export function Placements({ station, progress, submit }: PlacementProps) {
  const [selected, setSelected] = useState<Item | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean; invalid?: string } | null>(null);
  const start = useRef<PointerStart | null>(null);
  const ignoreClick = useRef<string | null>(null);
  const scene = useRef<HTMLDivElement>(null);
  const tray = useRef<HTMLDivElement>(null);
  const assigned = progress.placements[station.stage];
  const itemsIn = (target: string) => station.items.filter((item) => assigned[item.id] === target);
  const assembly = station.stage === "BARBELL" ? barbellLayout(assigned) : null;
  const remaining = station.items.length - Object.keys(assigned).length;

  function select(item: Item) {
    setSelected(item);
    setFeedback(null);
  }

  function choose(event: MouseEvent, item: Item) {
    if (ignoreClick.current === item.id && event.detail > 0) {
      ignoreClick.current = null;
      return;
    }
    select(item);
    if (event.detail === 0) scene.current?.querySelector<HTMLButtonElement>("[data-drop]")?.focus({ preventScroll: true });
  }

  function drop(item: Item, target: string, keyboard = false) {
    const result = submit({ kind: "place", stage: station.stage, item: item.id, destination: target });
    if (result.accepted) {
      setSelected(null);
      setFeedback({ text: result.message });
      if (keyboard) {
        requestAnimationFrame(() => tray.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true }));
      }
    } else {
      setSelected(item);
      setFeedback({ text: result.message, error: true, invalid: target });
    }
  }

  function removeSelected() {
    if (!selected) return;
    const result = submit({ kind: "remove-disk", item: selected.id });
    if (result.accepted) setSelected(null);
    setFeedback({ text: result.message, error: !result.accepted });
  }

  function verifyAssembly() {
    const result = submit({ kind: "check-barbell" });
    setFeedback({ text: result.message, error: !result.accepted });
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>, item: Item) {
    if (!event.isPrimary || event.button !== 0) return;
    ignoreClick.current = null;
    start.current = { pointerId: event.pointerId, item, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = start.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!active.moved) {
      if (Math.hypot(event.clientX - active.x, event.clientY - active.y) < 7) return;
      active.moved = true;
      select(active.item);
    }
    setDrag({ item: active.item, x: event.clientX, y: event.clientY, over: hitTarget(event) });
  }

  function pointerEnd(event: PointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const active = start.current;
    if (!active || active.pointerId !== event.pointerId) return;
    start.current = null;
    setDrag(null);
    if (cancelled) return;
    ignoreClick.current = active.item.id;
    if (!active.moved) {
      // Chromium can suppress a native click for the tap immediately after a drag.
      select(active.item);
      return;
    }
    const target = hitTarget(event);
    if (target) drop(active.item, target);
  }

  function destination(target: Destination, children: ReactNode, extra = "") {
    return (
      <button
        type="button"
        key={target.id}
        className={`destination ${extra}`}
        aria-label={target.label}
        data-drop={target.id}
        data-armed={selected ? "true" : undefined}
        data-over={drag?.over === target.id ? "true" : undefined}
        data-error={feedback?.invalid === target.id ? "true" : undefined}
        onClick={(event) => selected
          ? drop(selected, target.id, event.detail === 0)
          : setFeedback({ text: "Сначала выбери предмет под игровой зоной." })}
      >
        {children}
      </button>
    );
  }

  const instruction = selected ? `Выбрано: ${shortLabel(station.stage, selected)}. Укажи место.` : "Нажми на предмет или перетащи его.";

  return (
    <div onKeyDown={(event) => {
      if (event.key === "Escape") { setSelected(null); setFeedback(null); }
    }}>
      <div className={`play-scene scene-${station.stage.toLowerCase()}`} ref={scene}>
        {station.stage === "DUMBBELLS" && (
          <div className="rack">
            <div className="rack-shelf" aria-hidden="true" />
            <div className="rack-leg rack-leg-left" aria-hidden="true" />
            <div className="rack-leg rack-leg-right" aria-hidden="true" />
            <div className="rack-slots">
              {station.targets.map((target) => {
                const placed = itemsIn(target.id);
                const pair = target.id === "RACK_8" ? [initialDumbbell, ...placed] : placed;
                return destination(target, <>
                  <span className="rack-pocket">
                    {pair.length === 2 ? <span className="placed-art"><Equipment name="dumbbells" /></span>
                      : pair.length === 1 ? <span className="placed-art"><ItemArt item={pair[0]} station="DUMBBELLS" /></span>
                      : <span className="rack-outline" aria-hidden="true"><Equipment name="dumbbells" /><Icon name="plus" size={18} /></span>}
                  </span>
                  <span className="rack-weight">
                    {target.label.replace("Ячейка ", "")}
                    {pair.length === 2 ? <Icon name="check" size={15} /> : <small>{pair.length}/2</small>}
                  </span>
                </>, pair.length === 2 ? "filled rack-slot" : "rack-slot");
              })}
            </div>
          </div>
        )}

        {assembly && (
          <>
            <div className="assembly-mass">
              <span>Текущий вес</span>
              <strong data-current-weight={assembly.totalKg} aria-live="polite">{assembly.totalKg} кг</strong>
              <span>Цель {barbell.targetKg} кг</span>
            </div>
            <div className="barbell-scene">
              <div className="bar-shaft" aria-hidden="true"><i /><i /></div>
              <div className="barbell-sides">
                {station.targets.map((target, index) => {
                  const installed = itemsIn(target.id).sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0));
                  const kg = index === 0 ? assembly.leftKg : assembly.rightKg;
                  return destination(target, <>
                    <span className="side-name">{index === 0 ? "Слева" : "Справа"}</span>
                    <strong className="side-weight">{kg}<small> кг</small></strong>
                    <span className="mounted" aria-hidden="true">
                      <span className="mounted-plate base-plate"><Equipment name="plate" /></span>
                      {installed.map((item) => <span key={item.id} className={`mounted-plate mounted-${item.weightKg}`}><ItemArt item={item} station="BARBELL" /></span>)}
                    </span>
                    <span className="side-goal">{[barbell.startingDiskKg, ...installed.map((item) => item.weightKg)].join(" + ")}</span>
                  </>, "barbell-side");
                })}
              </div>
            </div>
            <p className="scene-caption">Гриф {barbell.shaftKg} кг входит в общий вес.</p>
          </>
        )}

        {station.stage === "INVENTORY" && (
          <>
          <p className="inventory-floor">В проходе осталось {remaining} из {station.items.length}</p>
          <div className="inventory-zones">
            {station.targets.map((target) => {
              const stored = itemsIn(target.id);
              return destination(target, <>
                <span className="zone-title"><strong>{target.label}</strong><span>{stored.length}/2</span></span>
                <span className="zone-shelf">
                  {[0, 1].map((i) => stored[i]
                    ? <span className="placed-art" key={stored[i].id}><ItemArt item={stored[i]} station={station.stage} /></span>
                    : <span className="zone-outline" key={i}><Equipment name={zoneArt[target.id]} /></span>)}
                </span>
              </>, stored.length === 2 ? "filled inventory-zone" : "inventory-zone");
            })}
          </div>
          </>
        )}
      </div>

      <div className={`placement-feedback ${feedback?.error ? "is-error" : ""}`} role="status" aria-live="polite" aria-atomic="true">
        <Icon name={feedback?.error ? "alert" : selected ? "arrow" : "info"} size={17} />
        <span>{feedback?.text ?? instruction}</span>
      </div>

      <div className={`object-tray tray-${station.stage.toLowerCase()}`} ref={tray}>
        {station.items.map((item) => {
          const placed = Object.hasOwn(assigned, item.id);
          return (
            <button
              key={item.id}
              type="button"
              className="game-object"
              aria-label={item.label}
              aria-pressed={selected?.id === item.id}
              disabled={placed && station.stage !== "BARBELL"}
              data-mounted={assembly && placed ? assigned[item.id] : undefined}
              onClick={(event) => choose(event, item)}
              onPointerDown={(event) => pointerDown(event, item)}
              onPointerMove={pointerMove}
              onPointerUp={(event) => pointerEnd(event, false)}
              onPointerCancel={(event) => pointerEnd(event, true)}
              onLostPointerCapture={(event) => pointerEnd(event, true)}
            >
              <span className="object-image"><ItemArt station={station.stage} item={item} /></span>
              <span className="object-label">{placed && (assembly ? (assigned[item.id] === "LEFT" ? "←" : "→") : <Icon name="check" size={13} />)}{shortLabel(station.stage, item)}</span>
            </button>
          );
        })}
      </div>
      {assembly && (
        <div className="assembly-actions">
          <button className="button primary" type="button" onClick={verifyAssembly}>Проверить <Icon name="check" size={18} /></button>
          {selected && Object.hasOwn(assigned, selected.id) && (
            <button className="button secondary" type="button" onClick={removeSelected}>Снять выбранный диск</button>
          )}
          <button className="button quiet" type="button" onClick={() => setFeedback({
            text: `Добавь по ${(barbell.targetKg - barbell.shaftKg) / 2 - barbell.startingDiskKg} кг с каждой стороны. Подбери одинаковые наборы.`,
          })}>Подсказка</button>
        </div>
      )}
      {drag && createPortal(
        <div className="drag-ghost" aria-hidden="true" style={{ left: drag.x, top: drag.y }}>
          <ItemArt station={station.stage} item={drag.item} />
        </div>,
        document.body,
      )}
    </div>
  );
}
