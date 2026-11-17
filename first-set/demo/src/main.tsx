import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { newProgress, nextStation, start, stationProgress, submit, type Action } from "./engine/game";
import { stations, stationTotal } from "./engine/scenario";
import { BenchStation } from "./ui/bench";
import { Icon } from "./ui/graphics";
import { BarbellScene, DumbbellScene, InventoryScene } from "./ui/gym";
import { Briefing, Finish, Route, SceneResult, ShiftCover, Skip, TrainingInfo, type Training } from "./ui/screens";
import { ClubAction, ClubCalendar, ClubHeader, ClubNavigation, Home, type ClubTab } from "./ui/home";
import { SceneButton } from "./ui/scene-button";
import "./style.css";

type EntryView = ClubTab | "cover" | "briefing" | "route" | "play" | "skip";
type View = EntryView | "training";

function App() {
  const [session, setSession] = useState(newProgress);
  const [view, setView] = useState<View>("home");
  const [entryTab, setEntryTab] = useState<ClubTab>("home");
  const [training, setTraining] = useState<{ target: Training; from: EntryView }>({ target: "smart-start", from: "home" });
  const preview = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const station = stations[session.stageIndex];
  const play = view === "play";
  const lesson = play && session.phase === "lesson";
  const complete = play && session.phase === "complete";
  const spatial = station.stage !== "BENCH";
  const sceneResult = lesson;
  const stageHeader = play && !complete;
  const stationScreen = play && (session.phase === "playing" || sceneResult);
  const clubTab = view === "home" || view === "calendar" || view === "action" ? view : null;

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
  }, [view, session.phase, session.stageIndex, sceneResult]);

  function home() {
    setSession(newProgress());
    setView("home");
    screen.current?.scrollTo({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function begin(from: ClubTab) {
    setEntryTab(from);
    setView("cover");
  }

  function closeApproach() {
    setSession(newProgress());
    setView(entryTab);
  }

  function openTraining(target: Training) {
    if (view === "training") return;
    setTraining({ target, from: view });
    setView("training");
  }

  function enterStation() {
    setSession(start(session));
    setView("play");
  }

  function action(input: Action) {
    const result = submit(session, input);
    if (result.accepted) setSession(result.progress);
    return result;
  }

  function advance() {
    setSession(nextStation(session));
  }

  return (
    <div className="phone-preview" ref={preview}>
      <div className={"app" + (clubTab ? " app-club" : "") + (complete ? " app-finish" : "")} data-view={view} ref={screen}>
        {clubTab ? <ClubHeader home={home} /> : view === "briefing" ? null : stageHeader ? (
          <header className="scene-header shell" inert={sceneResult}>
            <SceneButton type="button" className="button quiet scene-route" onActivate={() => setView("route")} disabled={lesson}>
              <Icon name="back" size={17} /> Маршрут
            </SceneButton>
            <div className="scene-journey" aria-label={"Станция " + (session.stageIndex + 1) + " из " + stations.length}>
              <span>Станция {session.stageIndex + 1} из {stations.length}</span>
              <div aria-hidden="true">{stations.map((step, index) =>
                <i key={step.stage} data-step={index < session.stageIndex || index === session.stageIndex && lesson ? "done" : index === session.stageIndex ? "active" : undefined} />,
              )}</div>
            </div>
            <SceneButton type="button" className="button quiet scene-close" onActivate={closeApproach} aria-label="Выйти"><Icon name="close" size={22} /></SceneButton>
          </header>
        ) : (
          <header className="site-header">
            <div className="shell header-inner">
              <SceneButton type="button" className="wordmark" onActivate={home} aria-label="Первый подход — главная">
                <strong>DDX</strong><span>FITNESS</span>
              </SceneButton>
              {(view === "route" || view === "cover") &&
                <SceneButton type="button" className="button quiet scene-close" onActivate={closeApproach} aria-label="Выйти"><Icon name="close" size={22} /></SceneButton>}
              {view === "skip" &&
                <SceneButton type="button" className="button quiet training-link" onActivate={() => openTraining("smart-start")}>Smart Start <Icon name="external" size={17} /></SceneButton>}
            </div>
          </header>
        )}

        <main className={"shell main-shell" + (stationScreen && spatial ? " spatial-shell" : "")}>
          {view === "home" && <Home heading={heading} begin={() => begin("home")} training={openTraining} calendar={() => setView("calendar")} />}
          {view === "calendar" && <ClubCalendar heading={heading} training={openTraining} approach={() => begin("calendar")} />}
          {view === "action" && <ClubAction heading={heading} begin={() => begin("action")} training={openTraining} />}
          {view === "cover" && <ShiftCover heading={heading} begin={() => setView("briefing")} skip={() => setView("skip")} />}
          {view === "briefing" && <Briefing heading={heading} next={() => setView("route")} back={() => setView("cover")} />}
          {view === "route" && <Route heading={heading} progress={session} begin={enterStation} />}
          {view === "skip" && <Skip heading={heading} back={home} training={() => openTraining("smart-start")} />}
          {view === "training" && <TrainingInfo heading={heading} active={training.target} back={() => setView(training.from)} />}

          {complete && <Finish heading={heading} training={openTraining} home={home} />}
          {stationScreen && (
            <section className={"game" + (spatial ? " game-spatial" : "")} key={station.stage}>
              <div className="station-content" inert={sceneResult}>
                <div className="station-brief">
                  <div className="game-heading">
                    <h1 ref={sceneResult ? undefined : heading} tabIndex={-1}>{station.title}</h1>
                    {station.stage !== "BARBELL" && <p className="stage-score" aria-label={"Выполнено " + stationProgress(session, station) + " из " + stationTotal(station)}>
                      <Icon name="check" size={15} />
                      <strong>{stationProgress(session, station)}</strong><span> / {stationTotal(station)}{station.stage === "DUMBBELLS" ? " пар" : ""}</span>
                    </p>}
                  </div>
                </div>
                {station.stage === "DUMBBELLS" && <DumbbellScene station={station} progress={session} submit={action} />}
                {station.stage === "BARBELL" && <BarbellScene progress={session} submit={action} />}
                {station.stage === "BENCH" && <BenchStation progress={session} submit={action} />}
                {station.stage === "INVENTORY" && <InventoryScene station={station} progress={session} submit={action} />}
                <div className="stage-footer">
                  <SceneButton type="button" className="button quiet training-link" onActivate={() => openTraining("smart-start")}>Smart Start <Icon name="external" size={17} /></SceneButton>
                </div>
              </div>
              {sceneResult && <SceneResult heading={heading} stage={station.stage} next={advance} />}
            </section>
          )}
        </main>

        {view === "home" && <footer className="site-footer"><div className="shell">Неофициальный макет DDX Fitness</div></footer>}
        {clubTab && <ClubNavigation tab={clubTab} go={(tab) => tab === "home" ? home() : setView(tab)} training={openTraining} />}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
