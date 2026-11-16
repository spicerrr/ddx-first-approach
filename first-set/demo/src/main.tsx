import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { newProgress, nextStation, start, stationProgress, submit, type Action } from "./engine/game";
import { stationDetails, stations, stationTotal, type PlacementStation, type Station } from "./engine/scenario";
import { readData, saveData, withUiEvent, type LocalData, type Training } from "./engine/store";
import { BenchChecks } from "./ui/bench";
import { Icon } from "./ui/graphics";
import { Placements } from "./ui/placements";
import { Finish, Home, Lesson, Route, Skip, TrainingInfo } from "./ui/screens";
import "./style.css";

type EntryView = "home" | "route" | "play" | "skip";
type View = EntryView | "training";

function App() {
  const [loaded] = useState(readData);
  const [data, setData] = useState(loaded.data);
  const [storageIssue, setStorageIssue] = useState(loaded.status);
  const [view, setView] = useState<View>("home");
  const [training, setTraining] = useState<{ target: Training; from: EntryView }>({ target: "smart-start", from: "home" });
  const screen = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const session = data.progress;
  const station = stations[session.stageIndex];
  const lesson = view === "play" && session.phase === "lesson";

  function write(next: LocalData) {
    setData(next);
    if (!saveData(next)) setStorageIssue("unavailable");
  }

  useEffect(() => {
    write(withUiEvent(loaded.data, { type: "onboarding_offer_exposed", at: new Date().toISOString() }));
  }, [loaded]);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    screen.current?.scrollTo({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view, session.phase, session.stageIndex]);

  function home() {
    if (view === "home") return;
    write(withUiEvent(data, { type: "onboarding_offer_exposed", at: new Date().toISOString() }));
    setView("home");
  }

  function openTraining(target: Training) {
    if (view === "training") return;
    write(withUiEvent(data, {
      type: "intro_cta_clicked", at: new Date().toISOString(), from: view, destination: target,
    }));
    setTraining({ target, from: view });
    setView("training");
  }

  function enterStation() {
    setStorageIssue((issue) => issue === "invalid" ? "ok" : issue);
    write({ ...data, progress: start(session) });
    setView("play");
  }

  function begin() {
    setView(session.phase === "ready" ? "route" : "play");
  }

  function action(input: Action) {
    const result = submit(session, input);
    if (result.accepted) write({ ...data, progress: result.progress });
    return result;
  }

  function restart() {
    resetDialog.current?.close();
    write({ ...data, progress: start(newProgress()) });
    setView("play");
    heading.current?.focus({ preventScroll: true });
  }

  const showReset = () => resetDialog.current?.showModal();

  return (
    <div className={`app${lesson ? " app-lesson" : ""}${view === "home" ? " app-home" : ""}`} ref={screen}>
      <header className="site-header">
        <div className="shell header-inner">
          <button type="button" className="wordmark" onClick={home} aria-label="Первый подход — главная">
            <strong>DDX</strong><span>FITNESS</span>
          </button>
          {(view === "play" || view === "route") && <div className="header-actions">
            {view === "play" && session.phase === "playing" &&
              <button type="button" className="button quiet" onClick={() => setView("route")}>Маршрут</button>}
            <button type="button" className="button quiet" onClick={home}>Выйти <Icon name="close" size={18} /></button>
          </div>}
          {(view === "home" || view === "skip") && <button type="button" className="button quiet training-link" onClick={() => openTraining("smart-start")}>Smart Start <Icon name="external" size={17} /></button>}
        </div>
      </header>

      <main className="shell main-shell">
        {storageIssue !== "ok" && (
          <div className="storage-notice" role="status">
            <Icon name="info" size={18} />
            {storageIssue === "invalid"
              ? "Старое сохранение не удалось открыть. Можно начать знакомство заново."
              : "Браузер не разрешил сохранить игру. Прогресс доступен, пока страница открыта."}
          </div>
        )}
        {view === "home" && <Home heading={heading} phase={session.phase} lessonIndex={session.stageIndex} begin={begin} skip={() => setView("skip")} restart={showReset} />}
        {view === "route" && <Route heading={heading} progress={session} begin={enterStation} />}
        {view === "skip" && <Skip heading={heading} back={home} training={() => openTraining("smart-start")} />}
        {view === "training" && <TrainingInfo heading={heading} active={training.target} back={() => setView(training.from)} />}

        {lesson && <Lesson heading={heading} index={session.stageIndex} next={() => write({ ...data, progress: nextStation(session) })} />}
        {view === "play" && session.phase === "complete" && <Finish heading={heading} training={openTraining} restart={showReset} />}
        {view === "play" && session.phase === "playing" && (
          <section className="game" key={station.stage}>
            <div className="game-progress">
              <ol className="station-track" aria-label="Станции игры">
                {stations.map((s, i) => (
                  <li key={s.stage} aria-current={i === session.stageIndex ? "step" : undefined} className={i < session.stageIndex ? "passed" : ""}>
                    {i < session.stageIndex && <Icon name="check" size={13} />} {stationDetails[s.stage].name}
                  </li>
                ))}
              </ol>
            </div>
            <div className="game-heading">
              <div>
                <p className="accent-label">Станция {session.stageIndex + 1} из {stations.length}</p>
                <h1 ref={heading} tabIndex={-1}>{station.title}</h1>
              </div>
              {station.stage !== "BARBELL" && <p className="stage-score" aria-label={`Выполнено ${stationProgress(session, station)} из ${stationTotal(station)}`}>
                <strong>{stationProgress(session, station)}</strong><span> / {stationTotal(station)}</span>
              </p>}
            </div>
            <p className="game-instruction">{stationDetails[station.stage].instruction}</p>
            {station.stage === "BENCH"
              ? <BenchChecks station={station} progress={session} submit={action} />
              : <Placements station={station as Station & { stage: PlacementStation }} progress={session} submit={action} />}
            <div className="stage-footer">
              <button type="button" className="button quiet training-link" onClick={() => openTraining("smart-start")}>Smart Start <Icon name="external" size={17} /></button>
            </div>
          </section>
        )}
      </main>

      {view === "home" && <footer className="site-footer"><div className="shell">Неофициальный макет DDX Fitness</div></footer>}

      <dialog className="reset-dialog" ref={resetDialog} aria-labelledby="reset-heading">
        <form method="dialog">
          <h2 id="reset-heading">Начать заново?</h2>
          <p>Текущее прохождение заменится новым.</p>
          <div className="reset-actions">
            <button type="submit" className="button secondary" autoFocus>Отмена</button>
            <button type="button" className="button primary" onClick={restart}>Начать заново <Icon name="arrow" /></button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
