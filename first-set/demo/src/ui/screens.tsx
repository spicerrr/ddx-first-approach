import type { Ref } from "react";
import { lastStation, stationDetails, stations, type StationId } from "../engine/scenario";
import type { Phase } from "../engine/game";
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
      <div className="welcome-copy">
        <p className="accent-label">Знакомство с тренажёрным залом</p>
        <h1 ref={heading} tabIndex={-1} id="welcome-title">Первый<br /><span>подход</span></h1>
        <p className="intro-text">Четыре ситуации, с которыми можно столкнуться в зале. Расставь гантели, собери штангу, проверь скамью и убери инвентарь.</p>
        <div className="welcome-actions">
          <button type="button" className="button primary" onClick={begin}>
            {hasResult ? "Открыть результат" : phase === "ready" ? "Начать знакомство" : "Продолжить"} <Icon name="arrow" />
          </button>
          {phase !== "ready" && <button type="button" className="button quiet" onClick={restart}>Начать заново</button>}
          <button type="button" className="button quiet" onClick={skip}>Пропустить</button>
        </div>
      </div>
      <figure className="welcome-image">
        <picture>
          <source media="(max-width: 699px)" srcSet={asset("rack-mobile")} />
          <img src={asset("rack")} width={1360} height={1020} alt="" fetchPriority="high" />
        </picture>
      </figure>
      <ol className="welcome-stations" aria-label="Четыре станции">
        {stations.map(({ stage }) => (
          <li key={stage}><Icon name={stationIcons[stage]} size={19} />{stationDetails[stage].name}</li>
        ))}
      </ol>
    </section>
  );
}

export function Lesson({ heading, index, next }: { heading: Heading; index: number; next: () => void }) {
  const station = stations[index];
  const detail = stationDetails[station.stage];
  const final = index === lastStation;
  return (
    <section className={`lesson lesson-${station.stage.toLowerCase()}`}>
      <div className="lesson-copy">
        <span className="success-symbol"><Icon name="check" size={37} /></span>
        <p className="accent-label">Станция {index + 1} из {stations.length} пройдена</p>
        <h1 ref={heading} tabIndex={-1}>{detail.lessonTitle}</h1>
        <p className="intro-text">{detail.lesson}</p>
      </div>
      <div className="lesson-visual" aria-hidden="true">
        <Equipment name={stationArt[station.stage]} />
      </div>
      <div className="lesson-actions">
        <span>{final ? "Четыре станции пройдены" : `Дальше — ${stationDetails[stations[index + 1].stage].name.toLocaleLowerCase("ru-RU")}`}</span>
        <button type="button" className="button ink" onClick={next}>
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
