import type { Ref } from "react";
import { barbell, stationDetails, stations, type StationId } from "../engine/scenario";
import { completedStationCount, type Progress } from "../engine/game";
import { asset, Icon } from "./graphics";
import { SceneButton } from "./scene-button";
import { CheckBurst, FinishMedal } from "./celebration";
import { CoachMessage } from "./coach-message";

type Heading = Ref<HTMLHeadingElement>;
export type Training = "smart-start" | "intro";

const stationArt = {
  DUMBBELLS: "nav-rack",
  BARBELL: "nav-barbell",
  BENCH: "nav-bench",
  INVENTORY: "nav-storage",
} satisfies Record<StationId, string>;

export function Route({ heading, progress, begin }: { heading: Heading; progress: Progress; begin: () => void }) {
  const done = completedStationCount(progress);
  return (
    <section className="route">
      <div className="game-heading">
        <h1 ref={heading} tabIndex={-1}>Маршрут</h1>
        <div className="route-counter" aria-label={`Пройдено ${done} из ${stations.length}`}>
          <span className="route-meter" aria-hidden="true">{stations.map(({ stage }, index) =>
            <i key={stage} data-step={index < done ? "done" : index === done ? "active" : undefined} />)}
          </span>
          <span><strong>{done}</strong> / {stations.length}</span>
        </div>
      </div>
      <CoachMessage>{done === 0 ? "Здесь четыре короткие станции. Начнём с гантелей."
        : `Следующая станция — ${stations[done].title.toLowerCase()}.`}</CoachMessage>
      <ol className="route-stations" role="list" aria-label="Станции">
        {stations.map(({ stage, title }, index) => {
          const completed = index < done;
          const current = index === done;
          return <li key={stage} aria-current={current ? "step" : undefined}
            data-progress={completed ? "done" : current ? "current" : "locked"}>
            <span className="route-number">{completed ? <><Icon name="check" size={16} /><span className="sr-only">Пройдено</span></> : index + 1}</span>
            <div className="route-copy"><strong>{title}</strong>
              <span>{stationDetails[stage].purpose}</span>
            </div>
            <div className="route-art">
              <img className="route-prop" src={asset(stationArt[stage])} alt="" />
            </div>
            {!completed && !current && <span className="route-lock" aria-label="Откроется после предыдущего задания"><Icon name="lock" size={14} /></span>}
          </li>;
        })}
      </ol>
      <SceneButton type="button" className="button primary" onActivate={begin}>
        {done === 0 && progress.phase === "ready" ? "Начать" : "К станции"} <Icon name="arrow" />
      </SceneButton>
    </section>
  );
}

export function SceneResult({ heading, stage, next }: { heading: Heading; stage: "DUMBBELLS" | "BARBELL"; next: () => void }) {
  const detail = stationDetails[stage];
  if (stage === "BARBELL") {
    return (
      <section className="barbell-result" aria-labelledby="scene-result-title">
        <CheckBurst />
        <h1 id="scene-result-title" tabIndex={-1} ref={heading}>{detail.lessonTitle}</h1>
        <ul aria-label="Проверка сборки">
          {([[`${barbell.targetKg} кг`, "weight"], ["Вес поровну", "balance"], [`${barbell.closedCollars} замка`, "lock"]] as const).map(([label, icon]) =>
            <li key={label}><span><Icon name="check" size={16} /></span>{label}<Icon name={icon} size={20} /></li>)}
        </ul>
        <div className="scene-result-tip">
          <Icon name="tip" size={23} />
          <p>Собирать штангу удобнее парами, начиная с тяжёлых дисков.</p>
        </div>
        <SceneButton type="button" className="button primary" onActivate={next}>{detail.nextButton} <Icon name="arrow" /></SceneButton>
      </section>
    );
  }
  return (
    <section className="scene-result" aria-labelledby="scene-result-title">
      <div className="scene-result-title">
        <CheckBurst />
        <h1 id="scene-result-title" tabIndex={-1} ref={heading}>{detail.lessonTitle}</h1>
      </div>
      <SceneButton type="button" className="button primary" onActivate={next}>{detail.nextButton} <Icon name="arrow" /></SceneButton>
    </section>
  );
}

export function Finish({ heading, onLink, startPoint }: {
  heading: Heading;
  onLink: (target: Training) => void;
  startPoint: () => void;
}) {
  return (
    <section className="finish">
      <header className="finish-hero">
        <FinishMedal />
        <div>
          <h1 ref={heading} tabIndex={-1}>Первый подход <span>пройден</span></h1>
          <ul className="finish-stations" aria-label="Пройденные станции">
            {stations.map(({ stage, title }) => <li key={stage}><Icon name="check" size={13} />{title}</li>)}
          </ul>
        </div>
      </header>
      <section className="finish-next" aria-labelledby="finish-next-title">
        <h2 id="finish-next-title">Выбери тренировку</h2>
        <TrainingOptions titleAs="h3" onLink={onLink} />
      </section>
      <SceneButton type="button" className="button quiet finish-back" onActivate={startPoint}>
        <Icon name="back" size={16} /> Вернуться в Точку старта
      </SceneButton>
    </section>
  );
}

const trainingOptions = {
  "smart-start": {
    name: "Smart Start",
    format: "Мини-группа",
    duration: "30 минут",
    description: "Попробуешь тренажёры. Тренер поможет с техникой и подбором веса.",
    action: "Выбрать занятие Smart Start",
    href: "https://www.ddxfitness.ru/group-training/2628/",
    art: "nav-mat",
  },
  intro: {
    name: "Ознакомительная тренировка",
    format: "С персональным тренером",
    duration: "55 минут",
    description: "Осмотришь зал, пройдёшь замер InBody и попробуешь упражнения с тренером.",
    action: "Выбрать время с тренером",
    href: "https://www.ddxfitness.ru/group-training/3076/",
    art: "coach-explaining",
  },
} as const;

function TrainingOptions({ first = "smart-start", titleAs: Title = "h2", onLink }: {
  first?: Training; titleAs?: "h2" | "h3"; onLink: (target: Training) => void;
}) {
  const order: Training[] = first === "smart-start" ? ["smart-start", "intro"] : ["intro", "smart-start"];
  return (
    <div className="training-options">
      {order.map((id) => {
        const option = trainingOptions[id];
        return (
          <article key={id} className="training-option" data-format={id} aria-labelledby={`training-title-${id}`}>
            <div className="training-option-heading">
              <p className="training-meta">{option.format} <span>· {option.duration}</span></p>
              <Title id={`training-title-${id}`}>{option.name}</Title>
            </div>
            <div className="training-art" aria-hidden="true"><img src={asset(option.art)} alt="" /></div>
            <p className="training-description">{option.description}</p>
            <a className="training-cta" href={option.href} onClick={() => onLink(id)} target="_blank" rel="noopener noreferrer">
              {option.action} <Icon name="external" size={17} />
            </a>
          </article>
        );
      })}
    </div>
  );
}

export function TrainingInfo({ heading, active, back, onLink }: { heading: Heading; active: Training; back: () => void;
  onLink: (target: Training) => void }) {
  return (
    <section className="training">
      <SceneButton type="button" className="button quiet back-link" onActivate={back}><Icon name="back" size={19} /> Назад</SceneButton>
      <h1 ref={heading} tabIndex={-1}>Первый визит<br /><span>с тренером</span></h1>
      <TrainingOptions first={active} onLink={onLink} />
    </section>
  );
}
