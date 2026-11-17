import type { Ref } from "react";
import { stationDetails, stations, type StationId } from "../engine/scenario";
import type { Progress } from "../engine/game";
import { asset, Icon } from "./graphics";
import { SceneButton } from "./scene-button";
import { CheckBurst, Confetti, ShiftMedal } from "./celebration";

type Heading = Ref<HTMLHeadingElement>;
export type Training = "smart-start" | "intro";

const stationArt: Record<StationId, string> = {
  DUMBBELLS: "dumbbell-floor-12",
  BARBELL: "bar-shaft",
  BENCH: "bench",
  INVENTORY: "mat",
};

export function ShiftCover({ heading, begin, skip }: { heading: Heading; begin: () => void; skip: () => void }) {
  return (
    <section className="shift-cover">
      <div className="shift-cover-hero">
        <div className="shift-cover-copy">
          <p>Твоя первая смена</p>
          <h1 ref={heading} tabIndex={-1}>Первый подход</h1>
        </div>
        <img src={asset("coach-avatar-blue")} alt="" width={640} height={800} fetchPriority="high" />
      </div>
      <p className="shift-cover-intro">Привет! Я тренер клуба. Хочешь пройтись по залу и попробовать, как здесь всё устроено?</p>
      <div className="shift-cover-actions">
        <SceneButton type="button" className="button primary" onActivate={begin}>Начать <Icon name="arrow" /></SceneButton>
        <SceneButton type="button" className="button quiet" onActivate={skip}>Пропустить игру</SceneButton>
      </div>
    </section>
  );
}

export function Route({ heading, progress, begin }: { heading: Heading; progress: Progress; begin: () => void }) {
  return (
    <section className="route">
      <h1 ref={heading} tabIndex={-1}>Твоя смена</h1>
      <p className="intro-text">{progress.phase === "ready" ? "Для начала заглянем к стойке с гантелями." : "Можно вернуться к тому месту, где мы остановились."}</p>
      <ol className="route-stations">
        {stations.map(({ stage }, index) => {
          const completed = index < progress.stageIndex;
          const current = index === progress.stageIndex;
          return <li key={stage} aria-current={current ? "step" : undefined}
            data-progress={completed ? "done" : current ? "current" : "locked"}>
            <span className="route-number">{completed ? <Icon name="check" size={16} /> : index + 1}</span>
            <div><strong>{stationDetails[stage].name}</strong>
              <span>{completed ? "Готово" : stationDetails[stage].mission}</span>
            </div>
            <div className="route-art">
              <img className="equipment route-prop" src={asset(stationArt[stage])} alt="" />
              {!completed && !current && <span className="route-lock" aria-label="Откроется после предыдущего задания"><Icon name="lock" size={14} /></span>}
            </div>
          </li>;
        })}
      </ol>
      <SceneButton type="button" className="button primary" onActivate={begin}>
        {progress.phase === "ready" ? "Начать смену" : "Вернуться к заданию"} <Icon name="arrow" />
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
        <ShiftMedal />
        <h1 ref={heading} tabIndex={-1}>Смена завершена</h1>
        <p className="intro-text">Спасибо за компанию! Хочешь попробовать всё в зале? На Smart Start тренер покажет оборудование и поможет сделать первый подход.</p>
        <div className="finish-actions">
          <SceneButton type="button" className="button primary" onActivate={() => training("smart-start")}>Посмотреть занятие Smart Start <Icon name="arrow" /></SceneButton>
          <SceneButton type="button" className="button quiet" onActivate={home}>На главный экран</SceneButton>
        </div>
      </div>
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
