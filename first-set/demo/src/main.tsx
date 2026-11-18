import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { completedStationCount, newProgress, nextStation, restoreProgress, start, stationProgress, stationTotal, submit, type Action } from "./engine/game";
import { readCompletedStations, saveCompletedStations } from "./engine/progress-storage";
import { track } from "./engine/analytics";
import { stations } from "./engine/scenario";
import { Icon } from "./ui/graphics";
import { Finish, Route, SceneResult, TrainingInfo, type Training } from "./ui/screens";
import { ClubAction, ClubCalendar, ClubHeader, ClubNavigation, ClubStartPoint, Home, type ClubTab } from "./ui/home";
import { SceneButton } from "./ui/scene-button";
import { Sheet } from "./ui/sheet";
import { useCoach } from "./ui/use-coach";
import { initialInputMode } from "./ui/input-mode";
import { GameHelp, HintExample, type Example, type HelpOptions } from "./ui/station-help";
import { enableAudio, playFeedback, unlockAudio } from "./ui/feedback";
import { StationBoard } from "./ui/station-board";
import { warmStation } from "./ui/station-resources";
import "./style.css";

type EntryView = ClubTab | "route" | "play" | "finish";
type View = EntryView | "training";
type Overlay = { kind: "exit" } | { kind: "help"; options: HelpOptions } | { kind: "example"; example: Example };

function App() {
  const [session, setSession] = useState(() => restoreProgress(readCompletedStations()));
  const savedCount = useRef(completedStationCount(session));
  const [view, setView] = useState<View>("home");
  const [overlay, setOverlay] = useState<Overlay>();
  const [training, setTraining] = useState<{ target: Training; from: EntryView }>({ target: "smart-start", from: "home" });
  const [inputMode, setInputMode] = useState(initialInputMode);
  const [soundOn, setSoundOn] = useState(true);
  const preview = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const station = stations[session.stageIndex];
  const coach = useCoach(station.stage);
  const placed = stationProgress(session, station);
  const total = stationTotal(station);
  const stationsDone = completedStationCount(session);
  const play = view === "play";
  const lesson = play && session.phase === "lesson";
  const complete = view === "finish";
  const completing = play && session.phase === "complete";
  const spatial = station.stage !== "BENCH";
  const sceneResult = lesson && station.stage !== "BENCH";
  const focusView = sceneResult ? "result" : complete ? "finish" : view;
  const stationScreen = play;
  const clubTab = view === "home" || view === "calendar" || view === "action" || view === "start-point" ? view : null;

  useEffect(() => {
    if (view === "start-point") track({ eventType: "first_approach_exposed" });
  }, [view]);

  useEffect(() => {
    if (!completing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setView("finish");
      return;
    }
    // Keep the last landing visible before switching to the result.
    const timer = window.setTimeout(() => setView("finish"), 920);
    return () => window.clearTimeout(timer);
  }, [completing]);

  useEffect(() => {
    if (!stationScreen) return;
    const following = stations[session.stageIndex + 1];
    if (!following) return;
    const preload = window.setTimeout(() => warmStation(following.stage), 450);
    return () => window.clearTimeout(preload);
  }, [stationScreen, session.stageIndex]);

  useEffect(() => {
    function sizePreview() {
      const scale = Math.max(.25, Math.min(1, (window.innerHeight - 32) / 888, (window.innerWidth - 32) / 416));
      preview.current?.style.setProperty("--phone-scale", String(scale));
    }
    sizePreview();
    window.addEventListener("resize", sizePreview);
    return () => window.removeEventListener("resize", sizePreview);
  }, []);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if (sceneResult) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const delay = reduceMotion ? 0 : 320;
      const timer = window.setTimeout(() => heading.current?.scrollIntoView({
        block: "nearest", behavior: reduceMotion ? "instant" : "smooth",
      }), delay);
      return () => window.clearTimeout(timer);
    } else {
      screen.current?.scrollTo({ top: 0, behavior: "instant" });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [focusView, session.stageIndex, sceneResult, station.stage]);

  function home() {
    if (complete) rememberCompleted(0);
    setSession(newProgress());
    setView("home");
    screen.current?.scrollTo({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function begin() {
    const restored = restoreProgress(savedCount.current);
    setSession(restored);
    coach.reset();
    setView(restored.phase === "complete" ? "finish" : "route");
  }

  function closeApproach() {
    setOverlay(undefined);
    setSession(restoreProgress(stationsDone));
    if (view === "route" && session.phase === "ready" && stationsDone === 0) {
      track({ eventType: "first_approach_skipped" });
    }
    setView("start-point");
  }

  function returnToRoute() {
    if (lesson) {
      setSession(nextStation(session));
      coach.reset();
    }
    setView("route");
  }

  function rememberCompleted(count: number) {
    savedCount.current = count;
    saveCompletedStations(count);
  }

  function openTraining(target: Training) {
    if (view === "training") return;
    setOverlay(undefined);
    setTraining({ target, from: view });
    setView("training");
  }

  function enterStation() {
    if (session.phase === "ready") {
      setSession(start(session));
      if (session.stageIndex === 0) track({ eventType: "first_approach_started" });
      track({ eventType: "first_approach_stage_started", stage: station.stage });
    }
    setView("play");
  }

  function action(input: Action) {
    coach.act();
    const result = submit(session, input);
    if (result.accepted) {
      setSession(result.progress);
      const done = completedStationCount(result.progress);
      if (done !== stationsDone) {
        rememberCompleted(done);
        track({ eventType: "first_approach_stage_completed", stage: station.stage });
        if (result.progress.phase === "complete") track({ eventType: "first_approach_completed" });
        playFeedback("complete");
      } else if (input.kind === "bench-adjustment") playFeedback("bench");
      if (input.kind === "finish-bench") {
        coach.reset();
        setView("route");
      }
    }
    return result;
  }

  function trainingLink(target: Training) {
    const source = training.from === "play" ? "station" : training.from;
    if (source === "start-point" || source === "station" || source === "finish") {
      track({ eventType: "training_cta_clicked", source, training: target });
    }
  }

  function leaveFinish() {
    rememberCompleted(0);
    setSession(newProgress());
    setView("start-point");
  }

  return (
    <div className="phone-preview" ref={preview}>
      <div className="phone-screen">
        <div className={"app" + (clubTab ? " app-club" : "") + (complete ? " app-finish" : "")} data-view={view}
          data-station={stationScreen ? station.stage : undefined} ref={screen}
          inert={Boolean(overlay)}
          onKeyDownCapture={(event) => {
            if (!event.altKey && !event.metaKey && !event.ctrlKey) setInputMode("keyboard");
            if (stationScreen && !event.repeat) unlockAudio();
          }}
          onTouchStartCapture={() => {
            setInputMode("touch");
            if (stationScreen) unlockAudio();
          }}
          onPointerDownCapture={(event) => {
            if (event.pointerType === "touch" || event.pointerType === "pen") setInputMode("touch");
            if (event.pointerType === "mouse") setInputMode("mouse");
            if (stationScreen) unlockAudio();
          }}>
          {clubTab ? <ClubHeader home={home} /> : stationScreen ? (
            <header className="scene-header shell">
              <SceneButton type="button" className="button quiet scene-route" onActivate={returnToRoute} disabled={completing}>
                <Icon name="back" size={17} /> Маршрут
              </SceneButton>
              <div className="scene-journey">
                <span>{`Станция ${session.stageIndex + 1} из ${stations.length}`}</span>
                <div aria-hidden="true">{stations.map((step, index) =>
                  <i key={step.stage} data-step={index < stationsDone ? "done" : index === session.stageIndex ? "active" : undefined} />,
                )}</div>
              </div>
              <SceneButton type="button" className="button quiet scene-close" onActivate={() => setOverlay({ kind: "exit" })} disabled={completing} aria-label="Выйти"><Icon name="close" size={22} /></SceneButton>
            </header>
          ) : (
            <header className="site-header">
              <div className="shell header-inner">
                <SceneButton type="button" className="wordmark" onActivate={view === "route" ? () => setOverlay({ kind: "exit" }) : home} aria-label="Первый подход — главная">
                  <strong>DDX</strong><span>FITNESS</span>
                </SceneButton>
                {view === "route" &&
                  <SceneButton type="button" className="button quiet scene-close" onActivate={() => setOverlay({ kind: "exit" })} aria-label="Выйти"><Icon name="close" size={22} /></SceneButton>}
              </div>
            </header>
          )}

          <main className={"shell main-shell" + (stationScreen && spatial ? " spatial-shell" : "")}>
            {view === "home" && <Home heading={heading} training={openTraining}
              calendar={() => setView("calendar")} action={() => setView("action")} startPoint={() => setView("start-point")} />}
            {view === "start-point" && <ClubStartPoint heading={heading} begin={begin} training={openTraining} />}
            {view === "calendar" && <ClubCalendar heading={heading} training={openTraining} />}
            {view === "action" && <ClubAction heading={heading} />}
            {view === "route" && <Route heading={heading} progress={session} begin={enterStation} />}
            {view === "training" && <TrainingInfo heading={heading} active={training.target}
              back={() => setView(training.from)} onLink={trainingLink} />}

            {complete && <Finish heading={heading} training={openTraining} startPoint={leaveFinish} />}
            {stationScreen && (
              <section className={"game" + (spatial ? " game-spatial" : "")} key={station.stage} data-completed={lesson || undefined}>
                <div className="station-content" inert={sceneResult}>
                  <div className="station-brief">
                    <div className="game-heading">
                      <h1 ref={sceneResult ? undefined : heading} tabIndex={-1}>{station.title}</h1>
                      {station.stage === "INVENTORY" ?
                        <p className="stage-score inventory-score" role="status" data-full={placed === total || undefined}>
                          {placed === total ? <>Всё на месте <Icon name="check" size={18} /></>
                            : <>Осталось <strong key={placed}>{total - placed}</strong></>}
                        </p> :
                        <p className="stage-score" data-full={placed === total || undefined} aria-label={"Выполнено " + placed + " из " + total}>
                          <Icon name="check" size={18} /><strong key={placed}>{placed}</strong>
                          <span>/ {total}{station.stage === "DUMBBELLS" && " пар"}</span>
                        </p>}
                    </div>
                  </div>
                  <GameHelp.Provider value={lesson || completing ? null : {
                    open: (options) => setOverlay({ kind: "help", options }),
                    showExample: (example) => setOverlay({ kind: "example", example }),
                    paused: Boolean(overlay),
                  }}>
                    <div inert={completing}>
                      <StationBoard station={station} progress={session} submit={action} coach={coach}
                        inputMode={inputMode} onExit={closeApproach} />
                    </div>
                  </GameHelp.Provider>
                </div>
                {sceneResult && (station.stage === "DUMBBELLS" || station.stage === "BARBELL") &&
                  <SceneResult heading={heading} stage={station.stage} next={returnToRoute} />}
              </section>
            )}
          </main>

          {view === "home" && <footer className="site-footer"><div className="shell">Неофициальный макет DDX Fitness</div></footer>}
          {clubTab && <ClubNavigation tab={clubTab} go={(tab) => tab === "home" ? home() : setView(tab)} training={openTraining} />}
        </div>
        {overlay && <Sheet title={overlay.kind === "exit" ? "Выйти из «Первого подхода»?"
          : overlay.kind === "help" ? "Нужна помощь?" : "Показать приём"} close={() => setOverlay(undefined)}>
          {overlay.kind === "exit" && <>
            <p>Прогресс завершённых станций сохранится.</p>
            <div className="sheet-actions">
              <SceneButton type="button" className="button primary" onActivate={() => setOverlay(undefined)}>Продолжить</SceneButton>
              <SceneButton type="button" className="button ghost" onActivate={closeApproach}>Выйти</SceneButton>
            </div>
          </>}
          {overlay.kind === "help" && <div className="help-actions">
            {overlay.options.hint && <SceneButton type="button" className="button secondary" onActivate={() => {
              overlay.options.hint?.();
              setOverlay(undefined);
            }}><Icon name="info" size={18} /> Подсказка</SceneButton>}
            {overlay.options.demo && <SceneButton type="button" className="button ghost" onActivate={() => {
              setOverlay(undefined);
              overlay.options.demo?.();
            }}><Icon name="play" size={18} /> Показать приём</SceneButton>}
            <SceneButton type="button" className="button quiet" onActivate={() => openTraining("intro")}>Занятия с тренером</SceneButton>
            <SceneButton type="button" className="button quiet" aria-label="Звук" aria-pressed={soundOn} onActivate={() => {
              enableAudio(!soundOn);
              setSoundOn(!soundOn);
            }}>Звук {soundOn ? "включён" : "выключен"}</SceneButton>
            <SceneButton type="button" className="button quiet" onActivate={() => setOverlay(undefined)}>Вернуться к станции</SceneButton>
          </div>}
          {overlay.kind === "example" && <>
            <HintExample example={overlay.example} />
            <SceneButton type="button" className="button primary" onActivate={() => setOverlay(undefined)}>К заданию</SceneButton>
          </>}
        </Sheet>}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
