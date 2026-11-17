import type { Ref } from "react";
import { stationDetails, stations, type StationId } from "../engine/scenario";
import type { Progress } from "../engine/game";
import { asset, Icon } from "./graphics";
import { SceneButton } from "./scene-button";
import { CheckBurst, Confetti, FinishMedal } from "./celebration";
import { CoachMessage } from "./coach-message";

type Heading = Ref<HTMLHeadingElement>;
export type Training = "smart-start" | "intro";

const stationArt = {
  DUMBBELLS: "dumbbell-floor-12",
  BARBELL: "bar-shaft",
  INVENTORY: "mat",
} satisfies Record<Exclude<StationId, "BENCH">, string>;

export function IntroCover({ heading, begin, training }: { heading: Heading; begin: () => void; training: () => void }) {
  return (
    <section className="intro-cover">
      <div className="intro-cover-hero">
        <h1 ref={heading} tabIndex={-1}>Первый раз в зале</h1>
        <img src={asset("coach-greeting")} alt="" width={407} height={510} fetchPriority="high" />
      </div>
      <p className="intro-cover-message">Привет! Собираешься на первую тренировку? Давай заранее разберёмся со снарядами. Покажу, где искать гантели и как выставить скамью.</p>
      <div className="intro-cover-actions">
        <SceneButton type="button" className="button primary" onActivate={begin}>Начать игру <Icon name="arrow" /></SceneButton>
        <SceneButton type="button" className="button ghost" onActivate={training}>Занятия с тренером <Icon name="arrow" size={17} /></SceneButton>
      </div>
    </section>
  );
}

export function Route({ heading, progress, begin }: { heading: Heading; progress: Progress; begin: () => void }) {
  return (
    <section className="route">
      <h1 ref={heading} tabIndex={-1}>Маршрут по залу</h1>
      {progress.phase === "ready" &&
        <CoachMessage>Представь, что ты у стойки с гантелями. Начнём здесь, а после подхода заглянем к полкам с инвентарём.</CoachMessage>}
      <ol className="route-stations" role="list" aria-label="Станции">
        {stations.map(({ stage }, index) => {
          const completed = index < progress.stageIndex;
          const current = index === progress.stageIndex;
          return <li key={stage} aria-current={current ? "step" : undefined}
            data-progress={completed ? "done" : current ? "current" : "locked"}>
            <span className="route-number">{completed ? <><Icon name="check" size={16} /><span className="sr-only">Пройдено</span></> : index + 1}</span>
            <div className="route-copy"><strong>{stationDetails[stage].name}</strong>
              <span>{stationDetails[stage].purpose}</span>
            </div>
            <div className="route-art">
              {stage === "BENCH" ? <Icon name="bench" size={35} /> :
                <img className="route-prop" src={asset(stationArt[stage])} alt="" />}
              {!completed && !current && <span className="route-lock" aria-label="Откроется после предыдущего задания"><Icon name="lock" size={14} /></span>}
            </div>
          </li>;
        })}
      </ol>
      <SceneButton type="button" className="button primary" onActivate={begin}>
        {progress.phase === "ready" ? "К гантелям" : "К станции"} <Icon name="arrow" />
      </SceneButton>
    </section>
  );
}

export function SceneResult({ heading, stage, next }: { heading: Heading; stage: StationId; next: () => void }) {
  const detail = stationDetails[stage];
  return (
    <div className="scene-result" role="dialog" aria-modal="true" aria-labelledby="scene-result-title">
      <section className="scene-result-card">
        <CheckBurst />
        <h1 id="scene-result-title" className="sr-only" tabIndex={-1} ref={heading}>{detail.lessonTitle}</h1>
        {stage === "BARBELL" && <p className="scene-result-tip">С одинаковыми дисками проще набирать вес поровну. Можно начать с тяжёлых и добавлять их парами.</p>}
        <SceneButton type="button" className="button primary" onActivate={next}>{detail.nextButton} <Icon name="arrow" /></SceneButton>
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
        <FinishMedal />
        <h1 ref={heading} tabIndex={-1}>До встречи в зале</h1>
        <p className="intro-text">Готово! Хочешь попробовать всё в зале вместе с тренером? Можно начать с ознакомительной тренировки в своём клубе.</p>
        <div className="finish-actions">
          <SceneButton type="button" className="button primary" onActivate={() => training("intro")}>Выбрать занятие с тренером <Icon name="arrow" /></SceneButton>
          <SceneButton type="button" className="button quiet" onActivate={home}>На главный экран</SceneButton>
        </div>
      </div>
    </section>
  );
}

const trainingOptions = {
  "smart-start": {
    name: "Smart Start",
    description: "30 минут в мини-группе. Выбираешь группу мышц, а тренер показывает упражнения и помогает с техникой.",
    action: "Посмотреть занятия Smart Start",
    href: "https://www.ddxfitness.ru/smart-start/",
    icon: "gym",
  },
  intro: {
    name: "Ознакомительная тренировка",
    description: "Для первого визита. Тренер покажет зоны твоего клуба и проведёт пробную тренировку.",
    action: "Открыть расписание по клубам",
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
      <h1 ref={heading} tabIndex={-1}>Первый визит<br /><span>с тренером</span></h1>
      <p className="intro-text">Можно начать с визита в свой клуб или выбрать короткое занятие на нужную группу мышц. Запись доступна в приложении DDX Fitness.</p>
      <div className="training-options">
        {options.map((id) => {
          const option = trainingOptions[id];
          return (
            <article key={id} className="training-option">
              <span className="recap-icon"><Icon name={option.icon} size={22} /></span>
              <h2>{option.name}</h2>
              <p>{option.description}</p>
              <a className={`button ${id === active ? "primary" : "secondary"}`} href={option.href} target="_blank" rel="noopener noreferrer">
                {option.action} <Icon name="external" size={18} />
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
