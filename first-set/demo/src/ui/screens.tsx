import { useState, type Ref } from "react";
import { stationDetails, stations, type StationId } from "../engine/scenario";
import type { Progress } from "../engine/game";
import { asset, Icon, type IconName } from "./graphics";
import { SceneButton } from "./scene-button";
import { CheckBurst, Confetti, ShiftMedal } from "./celebration";

type Heading = Ref<HTMLHeadingElement>;
export type Training = "smart-start" | "intro";

export const stationIcons: Record<StationId, IconName> = {
  DUMBBELLS: "gym",
  BARBELL: "level",
  BENCH: "bench",
  INVENTORY: "storage",
};

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
        <img src={asset("shift-cover")} alt="" width={840} height={1050} fetchPriority="high" />
        <div className="shift-cover-copy">
          <p>Твоя первая смена</p>
          <h1 ref={heading} tabIndex={-1}>Первый<br />подход</h1>
        </div>
      </div>
      <p className="shift-cover-intro">Побудь помощником тренера. Подготовь зал к следующей тренировке и разберись с оборудованием по ходу дела.</p>
      <div className="shift-cover-actions">
        <SceneButton type="button" className="button primary" onActivate={begin}>Начать <Icon name="arrow" /></SceneButton>
        <SceneButton type="button" className="button quiet" onActivate={skip}>Пропустить игру</SceneButton>
      </div>
    </section>
  );
}

const briefing = [
  { title: "Привет!", message: "Сегодня ты помогаешь мне в зале. Давай подготовим оборудование для тех, кто придёт тренироваться после нас." },
  { title: "Начнём со стойки", message: "Когда гантели лежат парами на своих местах, следующий человек быстрее находит нужный вес." },
  { title: "Я буду рядом", message: "Потом соберём штангу, поможем посетителю и освободим проход. Если что-то застопорится, дам подсказку." },
];

export function Briefing({ heading, next, back }: { heading: Heading; next: () => void; back: () => void }) {
  const [step, setStep] = useState(0);
  const slide = briefing[step];
  const last = step === briefing.length - 1;
  return (
    <section className="coach-brief">
      <div className="coach-brief-top">
        <SceneButton type="button" className="button quiet" aria-label="Назад" onActivate={() => step ? setStep(step - 1) : back()}><Icon name="back" size={20} /></SceneButton>
        <div className="coach-brief-progress" aria-label={`Реплика ${step + 1} из ${briefing.length}`}>
          <div aria-hidden="true"><i style={{ width: (step + 1) / briefing.length * 100 + "%" }} /></div>
          <span aria-hidden="true">{step + 1} / {briefing.length}</span>
        </div>
        <SceneButton type="button" className="button quiet" onActivate={next}>Пропустить</SceneButton>
      </div>
      <img className="coach-photo" src={asset("approach-coach")} alt="" width={370} height={562} />
      <div className="coach-dialogue" aria-live="polite" aria-atomic="true">
        <h1 ref={heading} tabIndex={-1}>{slide.title}</h1>
        <p>{slide.message}</p>
      </div>
      <div className="coach-brief-actions">
        <div className="coach-brief-dots" aria-hidden="true">{briefing.map((item, index) => <i data-current={index === step || undefined} key={item.title} />)}</div>
        <SceneButton type="button" className="button secondary coach-brief-next" aria-label={last ? "К смене" : "Дальше"} onActivate={() => last ? next() : setStep(step + 1)}>
          <Icon name="arrow" />
        </SceneButton>
      </div>
    </section>
  );
}

export function Route({ heading, progress, begin }: { heading: Heading; progress: Progress; begin: () => void }) {
  return (
    <section className="route">
      <h1 ref={heading} tabIndex={-1}>Твоя смена</h1>
      <p className="intro-text">{progress.phase === "ready" ? "Четыре дела в зале. Начни со стойки гантелей." : "Здесь видно, что уже готово и какие дела остались."}</p>
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
        <p className="intro-text">Все четыре дела сделаны. Продолжить знакомство с залом можно на занятии с тренером.</p>
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
