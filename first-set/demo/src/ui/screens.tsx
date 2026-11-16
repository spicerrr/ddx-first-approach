import type { Ref } from "react";
import { lastStation, stationDetails, stations, type StationId } from "../engine/scenario";
import type { Phase, Progress } from "../engine/game";
import type { Training } from "../engine/store";
import { asset, Equipment, Icon, type ArtName, type IconName } from "./graphics";

type Heading = Ref<HTMLHeadingElement>;

export const stationIcons: Record<StationId, IconName> = {
  DUMBBELLS: "gym",
  BARBELL: "level",
  BENCH: "bench",
  INVENTORY: "storage",
};

const stationArt: Record<StationId, ArtName> = {
  DUMBBELLS: "dumbbells",
  BARBELL: "plate",
  BENCH: "bench",
  INVENTORY: "mat",
};

export function Home({ heading, phase, lessonIndex, begin, skip, restart }: {
  heading: Heading;
  phase: Phase;
  lessonIndex: number;
  begin: () => void;
  skip: () => void;
  restart: () => void;
}) {
  const hasResult = phase === "complete" || phase === "lesson" && lessonIndex === lastStation;
  return (
    <section className="welcome">
      <p className="home-label">Главная</p>
      <article className="onboarding-card">
        <figure className="welcome-image">
          <img src={asset("rack-mobile")} width={1024} height={1360} alt="" fetchPriority="high" />
        </figure>
        <div className="welcome-copy">
          <h1 ref={heading} tabIndex={-1} id="welcome-title">Первый подход</h1>
          <p className="intro-text">Пройди четыре станции и подготовься к первому визиту в зал.</p>
          <button type="button" className="button primary" onClick={begin}>
            {hasResult ? "Открыть результат" : phase === "ready" ? "Начать знакомство" : "Продолжить"} <Icon name="arrow" />
          </button>
        </div>
      </article>
      <div className="welcome-actions">
        {phase !== "ready" && <button type="button" className="button quiet" onClick={restart}>Начать заново</button>}
        <button type="button" className="button quiet" onClick={skip}>Пропустить</button>
      </div>
    </section>
  );
}

export function Route({ heading, progress, begin }: { heading: Heading; progress: Progress; begin: () => void }) {
  return (
    <section className="route">
      <h1 ref={heading} tabIndex={-1}>Твой маршрут</h1>
      <p className="intro-text">Четыре ситуации перед первым подходом в зале.</p>
      <ol className="route-stations">
        {stations.map(({ stage }, index) => {
          const completed = index < progress.stageIndex;
          const current = index === progress.stageIndex;
          return <li key={stage} aria-current={current ? "step" : undefined}>
            <span className="route-number">{completed ? <Icon name="check" size={16} /> : index + 1}</span>
            <div><strong>{stationDetails[stage].name}</strong>
              <span>{completed ? "Пройдено" : current ? "Можно начать" : "После предыдущей станции"}</span>
            </div>
            <Equipment name={stationArt[stage]} />
          </li>;
        })}
      </ol>
      <button type="button" className="button primary" onClick={begin}>
        {progress.phase === "ready" ? "Начать маршрут" : "Вернуться к заданию"} <Icon name="arrow" />
      </button>
    </section>
  );
}

export function Lesson({ heading, index, next }: { heading: Heading; index: number; next: () => void }) {
  const station = stations[index];
  const detail = stationDetails[station.stage];
  const final = index === lastStation;
  return (
    <section className={`lesson lesson-${station.stage.toLowerCase()}`}>
      <div className="lesson-visual" aria-hidden="true">
        <Equipment name={stationArt[station.stage]} />
      </div>
      <div className="lesson-copy">
        <span className="success-symbol"><Icon name="check" size={30} /></span>
        <p className="accent-label">Станция {index + 1} из {stations.length} пройдена</p>
        <h1 ref={heading} tabIndex={-1}>{detail.lessonTitle}</h1>
        <p className="intro-text">{detail.lesson}</p>
        <button type="button" className="button primary" onClick={next}>
          {final ? "К результату" : "Следующая станция"} <Icon name="arrow" />
        </button>
      </div>
    </section>
  );
}

export function Finish({ heading, training, restart }: {
  heading: Heading;
  training: (target: Training) => void;
  restart: () => void;
}) {
  return (
    <section className="finish">
      <div>
        <p className="accent-label"><Icon name="check" size={18} /> Четыре станции пройдены</p>
        <h1 ref={heading} tabIndex={-1}>Первый подход<br /><span>завершён</span></h1>
        <p className="intro-text">В зале можно продолжить знакомство с оборудованием вместе с тренером.</p>
        <div className="finish-actions">
          <button type="button" className="button primary" onClick={() => training("smart-start")}>Smart Start <Icon name="arrow" /></button>
          <button type="button" className="button secondary" onClick={() => training("intro")}>Ознакомительная тренировка <Icon name="arrow" /></button>
          <button type="button" className="button quiet" onClick={restart}>Пройти ещё раз</button>
        </div>
      </div>
      <ul className="recap" aria-label="Памятка после прохождения">
        {stations.map(({ stage }) => (
          <li key={stage}>
            <span className="recap-icon"><Icon name={stationIcons[stage]} size={21} /></span>
            <div><strong>{stationDetails[stage].name}</strong><p>{stationDetails[stage].takeaway}</p></div>
            <Icon name="check" size={18} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const trainingOptions = {
  "smart-start": {
    name: "Smart Start",
    description: "Вводное занятие в небольшой группе. Тренер знакомит с упражнениями и оборудованием.",
    href: "https://www.ddxfitness.ru/smart-start/",
    icon: "gym",
  },
  intro: {
    name: "Ознакомительная тренировка",
    description: "Знакомство с тренажёрами и зонами своего клуба вместе с тренером.",
    href: "https://www.ddxfitness.ru/group-training/3076/",
    icon: "person",
  },
} as const;

export function TrainingInfo({ heading, active, back }: { heading: Heading; active: Training; back: () => void }) {
  const alternate: Training = active === "smart-start" ? "intro" : "smart-start";
  const options: Training[] = [active, alternate];
  return (
    <section className="training">
      <button type="button" className="button quiet back-link" onClick={back}><Icon name="back" size={19} /> Назад</button>
      <h1 ref={heading} tabIndex={-1}>Знакомство с залом<br /><span>вместе с тренером</span></h1>
      <p className="intro-text">Расписание и запись доступны у DDX. Здесь можно посмотреть, чем отличаются занятия.</p>
      <div className="training-options">
        {options.map((id) => {
          const option = trainingOptions[id];
          return (
            <article key={id} className="training-option">
              <span className="recap-icon"><Icon name={option.icon} size={22} /></span>
              <h2>{option.name}</h2>
              <p>{option.description}</p>
              <a className={`button ${id === active ? "primary" : "secondary"}`} href={option.href} target="_blank" rel="noopener noreferrer">
                О занятии на сайте DDX <Icon name="external" size={18} />
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function Skip({ heading, back, training }: { heading: Heading; back: () => void; training: () => void }) {
  return (
    <section className="skip-screen">
      <h1 ref={heading} tabIndex={-1}>Знакомство <span>пропущено</span></h1>
      <p className="intro-text">К игре можно вернуться в любой момент. Открыть информацию о Smart Start можно сразу.</p>
      <button type="button" className="button primary" onClick={training}>Узнать о Smart Start <Icon name="arrow" /></button>
      <button type="button" className="button quiet back-link" onClick={back}><Icon name="back" size={19} /> На главный экран</button>
    </section>
  );
}
