import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { completedStationCount, newProgress, nextStation, restoreProgress, start, stationProgress, submit, type Action } from "./engine/game";
import { readCompletedStations, saveCompletedStations } from "./engine/progress-storage";
import { failedChallenge, newChallenge, submitChallenge } from "./engine/challenge";
import { stations, stationTotal } from "./engine/scenario";
import { Icon } from "./ui/graphics";
import { Finish, IntroCover, Route, SceneResult, TrainingInfo, type Training } from "./ui/screens";
import { ClubAction, ClubCalendar, ClubHeader, ClubNavigation, ClubStartPoint, Home, type ClubTab } from "./ui/home";
import { SceneButton } from "./ui/scene-button";
import { Sheet } from "./ui/sheet";
import { useCoach } from "./ui/use-coach";
import { initialInputMode } from "./ui/input-mode";
import { GameHelp, HintExample, type Example, type HelpOptions } from "./ui/station-help";
import { ChallengeScreen } from "./ui/challenge-screen";
import { enableAudio, playFeedback, unlockAudio } from "./ui/feedback";
import { StationBoard } from "./ui/station-board";
import { warmStation } from "./ui/station-resources";
import "./style.css";

type EntryView = ClubTab | "cover" | "route" | "play" | "transfer";
type View = EntryView | "training";
type Overlay = { kind: "exit" } | { kind: "help"; options: HelpOptions } | { kind: "example"; example: Example };

function App() {
  const [session, setSession] = useState(() => restoreProgress(readCompletedStations()));
  const savedCount = useRef(completedStationCount(session));
  const [view, setView] = useState<View>("home");
  const [entryTab, setEntryTab] = useState<ClubTab>("home");
  const [overlay, setOverlay] = useState<Overlay>();
  const [challenge, setChallenge] = useState<ReturnType<typeof newChallenge>>();
  const coach = useCoach();
  const [training, setTraining] = useState<{ target: Training; from: EntryView }>({ target: "smart-start", from: "home" });
  const [inputMode, setInputMode] = useState(initialInputMode);
  const [soundOn, setSoundOn] = useState(true);
  const preview = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const station = stations[session.stageIndex];
  const placed = stationProgress(session, station);
  const total = stationTotal(station);
  const stationsDone = completedStationCount(session);
  const play = view === "play";
  const lesson = play && session.phase === "lesson";
  const complete = play && session.phase === "complete";
  const spatial = station.stage !== "BENCH";
  const sceneResult = lesson && station.stage !== "BENCH";
  const focusView = sceneResult ? "result" : complete ? "finish" : view;
  const stageHeader = play && !complete || view === "transfer";
  const stationScreen = play && (session.phase === "playing" || lesson);
  const clubTab = view === "home" || view === "calendar" || view === "action" || view === "start-point" ? view : null;

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
      heading.current?.scrollIntoView({ block: "nearest" });
    } else {
      screen.current?.scrollTo({ top: 0, behavior: "instant" });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [focusView, session.stageIndex]);

  function home() {
    if (complete) rememberCompleted(0);
    setSession(newProgress());
    setView("home");
    screen.current?.scrollTo({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function begin(from: ClubTab) {
    const saved = savedCount.current;
    setSession(restoreProgress(saved));
    setChallenge(undefined);
    coach.reset();
    setEntryTab(from);
    setView(saved > 0 ? "route" : "cover");
  }

  function closeApproach() {
    setOverlay(undefined);
    setSession(restoreProgress(stationsDone));
    setView(entryTab);
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
    if (session.phase === "complete") {
      setChallenge((previous) => previous ?? newChallenge());
      setView("transfer");
      return;
    }
    setSession(start(session));
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
        playFeedback("complete");
      } else if (input.kind === "bench-adjustment") playFeedback("bench");
      if (input.kind === "finish-bench") {
        coach.reset();
        setView("route");
      }
    }
    return result;
  }

  function attempt(input: Action) {
    const next = submitChallenge(challenge!, input);
    setChallenge(next.challenge);
    if (next.challenge.outcome === "passed") playFeedback("complete");
    else if (input.kind === "bench-adjustment" && next.result.accepted) playFeedback("bench");
    return next.result;
  }

  function leaveFinish() {
    rememberCompleted(0);
    setSession(newProgress());
    setChallenge(undefined);
    setView("start-point");
  }

  return (
    <div className="phone-preview" ref={preview}>
      <div className="phone-screen">
        <div className={"app" + (clubTab ? " app-club" : "") + (complete ? " app-finish" : "")} data-view={view} ref={screen}
          inert={Boolean(overlay)}
          onKeyDownCapture={(event) => {
            if (!event.altKey && !event.metaKey && !event.ctrlKey) setInputMode("keyboard");
            if (stageHeader && !event.repeat) unlockAudio();
          }}
          onTouchStartCapture={() => {
            setInputMode("touch");
            if (stageHeader) unlockAudio();
          }}
          onPointerDownCapture={(event) => {
            if (event.pointerType === "touch" || event.pointerType === "pen") setInputMode("touch");
            if (event.pointerType === "mouse") setInputMode("mouse");
            if (stageHeader) unlockAudio();
          }}>
          {clubTab ? <ClubHeader home={home} /> : stageHeader ? (
            <header className="scene-header shell">
              <SceneButton type="button" className="button quiet scene-route" onActivate={returnToRoute}>
                <Icon name="back" size={17} /> Маршрут
              </SceneButton>
              <div className="scene-journey">
                <span>{view === "transfer" ? "Контрольная ситуация" : `Станция ${session.stageIndex + 1} из ${stations.length}`}</span>
                <div aria-hidden="true">{stations.map((step, index) =>
                  <i key={step.stage} data-step={index < stationsDone ? "done" : index === session.stageIndex ? "active" : undefined} />,
                )}</div>
              </div>
              <SceneButton type="button" className="button quiet scene-close" onActivate={() => setOverlay({ kind: "exit" })} aria-label="Выйти"><Icon name="close" size={22} /></SceneButton>
            </header>
          ) : (
            <header className="site-header">
              <div className="shell header-inner">
                <SceneButton type="button" className="wordmark" onActivate={view === "route" ? () => setOverlay({ kind: "exit" }) : home} aria-label="Первый подход — главная">
                  <strong>DDX</strong><span>FITNESS</span>
                </SceneButton>
                {(view === "route" || view === "cover") &&
                  <SceneButton type="button" className="button quiet scene-close" onActivate={view === "cover" ? closeApproach : () => setOverlay({ kind: "exit" })} aria-label="Выйти"><Icon name="close" size={22} /></SceneButton>}
              </div>
            </header>
          )}

          <main className={"shell main-shell" + (stationScreen && spatial ? " spatial-shell" : "")}>
            {view === "home" && <Home heading={heading} begin={() => begin("home")} training={openTraining}
              calendar={() => setView("calendar")} startPoint={() => setView("start-point")} />}
            {view === "start-point" && <ClubStartPoint heading={heading} begin={() => begin("start-point")} training={openTraining} />}
            {view === "calendar" && <ClubCalendar heading={heading} training={openTraining} approach={() => begin("calendar")} />}
            {view === "action" && <ClubAction heading={heading} begin={() => begin("action")} training={openTraining} />}
            {view === "cover" && <IntroCover heading={heading} begin={() => setView("route")} training={() => openTraining("intro")} />}
            {view === "route" && <Route heading={heading} progress={session} begin={enterStation} />}
            {view === "training" && <TrainingInfo heading={heading} active={training.target} back={() => setView(training.from)} />}
            {view === "transfer" && challenge && <ChallengeScreen challenge={challenge} heading={heading}
              inputMode={inputMode} submit={attempt} locked={() => setChallenge(failedChallenge(challenge))}
              restart={() => setChallenge(newChallenge(challenge.stage))} finish={() => setView("play")} />}

            {complete && <Finish heading={heading} training={openTraining} passed={challenge?.outcome === "passed"} startPoint={leaveFinish} />}
            {stationScreen && (
              <section className={"game" + (spatial ? " game-spatial" : "")} key={station.stage} data-completed={lesson || undefined}>
                <div className="station-content" inert={sceneResult}>
                  <div className="station-brief">
                    <div className="game-heading">
                      <h1 ref={sceneResult ? undefined : heading} tabIndex={-1}>{station.title}</h1>
                      {station.stage !== "BARBELL" && <p className="stage-score" aria-label={"Выполнено " + placed + " из " + total}>
                        <strong>{placed}</strong><span> / {total}{station.stage === "DUMBBELLS" && placed === 0 ? " пар" : ""}</span>
                        {placed === total && <Icon name="check" size={15} />}
                      </p>}
                    </div>
                  </div>
                  <GameHelp.Provider value={lesson ? null : {
                    open: (options) => setOverlay({ kind: "help", options }),
                    showExample: (example) => setOverlay({ kind: "example", example }),
                    paused: Boolean(overlay),
                  }}>
                    <StationBoard station={station} progress={session} submit={action} coach={coach} inputMode={inputMode} />
                  </GameHelp.Provider>
                </div>
                {sceneResult && <SceneResult heading={heading} stage={station.stage} next={returnToRoute} />}
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
