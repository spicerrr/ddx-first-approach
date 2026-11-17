import type { Ref } from "react";
import { stationDetails, stations, type StationId } from "../engine/scenario";
import type { Progress } from "../engine/game";
import { Equipment, Icon, sceneAsset, type ArtName, type IconName } from "./graphics";
import { SceneButton } from "./scene-button";
import { CheckBurst, Confetti } from "./celebration";

type Heading = Ref<HTMLHeadingElement>;
export type Training = "smart-start" | "intro";

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

export function Briefing({ heading, next, skip }: { heading: Heading; next: () => void; skip: () => void }) {
  return (
    <section className="coach-brief">
      <img className="coach-photo" src={sceneAsset("coach")} alt="" width={540} height={810} />
      <div className="coach-dialogue">
        <p className="coach-label">Тренер клуба</p>
        <h1 ref={heading} tabIndex={-1}>Привет!</h1>
        <p>Давай пройдёмся по залу. Я покажу, где оставить инвентарь и как разобраться со скамьёй перед подходом.</p>
        <SceneButton type="button" className="button primary" onActivate={next}>К маршруту <Icon name="arrow" /></SceneButton>
        <SceneButton type="button" className="button quiet" onActivate={skip}>Пропустить</SceneButton>
      </div>
    </section>
  );
}

export function Route({ heading, progress, begin }: { heading: Heading; progress: Progress; begin: () => void }) {
  return (
    <section className="route">
      <h1 ref={heading} tabIndex={-1}>Твой маршрут</h1>
      <p className="intro-text">Четыре задания перед первой тренировкой.</p>
      <ol className="route-stations">
        {stations.map(({ stage }, index) => {
          const completed = index < progress.stageIndex;
          const current = index === progress.stageIndex;
          return <li key={stage} aria-current={current ? "step" : undefined}>
            <span className="route-number">{completed ? <Icon name="check" size={16} /> : index + 1}</span>
            <div><strong>{stationDetails[stage].name}</strong>
              <span>{completed ? "Пройдено" : current ? "Можно начать" : "После предыдущей станции"}</span>
            </div>
            {stage === "DUMBBELLS" || stage === "BARBELL"
              ? <img className="equipment route-prop" src={sceneAsset(stage === "DUMBBELLS" ? "dumbbell-12" : "disk-10")} alt="" />
              : <Equipment name={stationArt[stage]} />}
          </li>;
        })}
      </ol>
      <SceneButton type="button" className="button primary" onActivate={begin}>
        {progress.phase === "ready" ? "Начать маршрут" : "Вернуться к заданию"} <Icon name="arrow" />
      </SceneButton>
    </section>
  );
}

export function SceneResult({ heading, stage, next }: { heading: Heading; stage: StationId; next: () => void }) {
  const detail = stationDetails[stage];
  return (
    <div className="scene-result" role="dialog" aria-modal="true" aria-labelledby="scene-result-title">
      <section className="scene-result-card">
        <h1 id="scene-result-title" className="sr-only" tabIndex={-1} ref={heading}>{detail.lessonTitle}</h1>
        <CheckBurst />
        <SceneButton type="button" className="button primary" onActivate={next}>{stage === "INVENTORY" ? "К результату" : "Следующая станция"} <Icon name="arrow" /></SceneButton>
      </section>
    </div>
  );
}

export function Finish({ heading, training, home }: {
  heading: Heading;
  training: (target: Training) => void;
  home: () => void;
}) {
  return (
    <section className="finish">
      <Confetti />
      <div>
        <CheckBurst className="finish-symbol" />
        <h1 ref={heading} tabIndex={-1}>Первый подход<br /><span>завершён</span></h1>
        <p className="intro-text">В зале можно продолжить знакомство с оборудованием вместе с тренером.</p>
        <div className="finish-actions">
          <SceneButton type="button" className="button primary" onActivate={() => training("smart-start")}>Smart Start <Icon name="arrow" /></SceneButton>
          <SceneButton type="button" className="button secondary" onActivate={() => training("intro")}>Ознакомительная тренировка <Icon name="arrow" /></SceneButton>
          <SceneButton type="button" className="button quiet" onActivate={home}>На главный экран</SceneButton>
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
      <SceneButton type="button" className="button quiet back-link" onActivate={back}><Icon name="back" size={19} /> Назад</SceneButton>
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
      <SceneButton type="button" className="button primary" onActivate={training}>Узнать о Smart Start <Icon name="arrow" /></SceneButton>
      <SceneButton type="button" className="button quiet back-link" onActivate={back}><Icon name="back" size={19} /> На главный экран</SceneButton>
    </section>
  );
}
