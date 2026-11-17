import { useRef, useState, type Ref } from "react";
import { asset, Icon, sceneAsset } from "./graphics";
import { SceneButton } from "./scene-button";
import type { Training } from "./screens";
import "./home.css";

type Heading = Ref<HTMLHeadingElement>;
type TrainingLink = (target: Training) => void;
export type ClubTab = "home" | "calendar" | "action";

export function ClubHeader({ home }: { home: () => void }) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="site-header club-header">
      <div className="shell header-inner">
        <SceneButton type="button" className="wordmark" onActivate={home} aria-label="DDX Fitness — главная">
          <strong>DDX</strong><span>FITNESS</span>
        </SceneButton>
        <SceneButton type="button" className="icon-button club-bell" onActivate={() => setShowNotifications(!showNotifications)}
          aria-label="Уведомления" aria-expanded={showNotifications} aria-controls="club-notifications">
          <Icon name="bell" size={22} />
        </SceneButton>
        <div className="club-notifications" id="club-notifications" hidden={!showNotifications} role="status">
          Новых уведомлений нет
        </div>
      </div>
    </header>
  );
}

export function ClubNavigation({ tab, go, training }: { tab: ClubTab; go: (tab: ClubTab) => void; training: TrainingLink }) {
  return (
    <nav className="club-navigation" aria-label="Разделы DDX Fitness">
      <SceneButton type="button" aria-current={tab === "home" ? "page" : undefined} onActivate={() => go("home")}>
        <Icon name="home" size={21} /><span>Главная</span>
      </SceneButton>
      <SceneButton type="button" aria-current={tab === "calendar" ? "page" : undefined} onActivate={() => go("calendar")}>
        <Icon name="calendar" size={21} /><span>Календарь</span>
      </SceneButton>
      <SceneButton type="button" onActivate={() => training("intro")}>
        <Icon name="gym" size={21} /><span>Тренеры</span>
      </SceneButton>
      <SceneButton type="button" aria-current={tab === "action" ? "page" : undefined} onActivate={() => go("action")}>
        <Icon name="play" size={21} /><span>Action</span>
      </SceneButton>
      <button type="button" disabled><Icon name="person" size={21} /><span>Профиль</span></button>
    </nav>
  );
}

function ApproachCard({ begin }: { begin: () => void }) {
  return (
    <article className="onboarding-card" aria-labelledby="approach-title" id="club-approach">
      <img className="approach-photo" src={asset("coach-neutral")} alt="" fetchPriority="high" />
      <div className="approach-copy">
        <h2 id="approach-title">Впервые<br />в зале?</h2>
        <p>Попробуй оборудование перед первой тренировкой.</p>
        <SceneButton type="button" className="button primary" onActivate={begin}>
          Открыть игру <Icon name="arrow" size={17} />
        </SceneButton>
      </div>
    </article>
  );
}

const dayFormat = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const fullDayFormat = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });

function Week({ showAgenda }: { showAgenda: boolean }) {
  const [today] = useState(() => new Date());
  const [selected, setSelected] = useState(today.toDateString());
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (date.getDay() + 6) % 7 + index);
    return date;
  });
  const day = week.find((date) => date.toDateString() === selected) ?? today;

  return (
    <>
      <ul className="club-week" aria-label="Текущая неделя">
        {week.map((date) => {
          const key = date.toDateString();
          return (
            <li key={key}>
              <SceneButton type="button" aria-label={fullDayFormat.format(date)} aria-pressed={selected === key}
                aria-current={key === today.toDateString() ? "date" : undefined} onActivate={() => setSelected(key)}>
                <span>{dayFormat.format(date)}</span><strong>{date.getDate()}</strong>
              </SceneButton>
            </li>
          );
        })}
      </ul>
      {showAgenda && <p className="club-agenda" aria-live="polite">{fullDayFormat.format(day)} · в календаре пока нет тренировок</p>}
    </>
  );
}

function TrainingShortcuts({ training, approach }: { training: TrainingLink; approach: () => void }) {
  return (
    <div className="club-training-cards">
      <SceneButton type="button" className="club-training-card" onActivate={() => training("smart-start")}>
        <strong>Групповые<br />тренировки</strong>
        <img src={asset("mat")} alt="" />
        <Icon name="chevron" size={15} />
      </SceneButton>
      <SceneButton type="button" className="club-training-card" onActivate={approach}>
        <strong>Самостоятельные<br />тренировки</strong>
        <img src={sceneAsset("dumbbell-8")} alt="" />
        <Icon name="chevron" size={15} />
      </SceneButton>
    </div>
  );
}

export function Home({ heading, begin, training, calendar }: {
  heading: Heading;
  begin: () => void;
  training: TrainingLink;
  calendar: () => void;
}) {
  const offer = useRef<HTMLDivElement>(null);

  function focusOffer() {
    const button = offer.current?.querySelector("button");
    button?.focus({ preventScroll: true });
    offer.current?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="club-home">
      <h1 className="sr-only" ref={heading} tabIndex={-1}>Главная DDX Fitness</h1>
      <section className="club-stories" aria-label="Знакомство с клубом">
        <SceneButton type="button" className="club-story story-smart" onActivate={() => training("smart-start")}>
          <img src={asset("mat")} alt="" /><span>Smart Start</span>
        </SceneButton>
        <SceneButton type="button" className="club-story story-gym" onActivate={focusOffer}>
          <img src={sceneAsset("dumbbell-12")} alt="" /><span>Первый визит<br />в зал</span>
        </SceneButton>
        <SceneButton type="button" className="club-story story-coach" onActivate={() => training("intro")}>
          <img src={asset("coach-neutral")} alt="" /><span>Тренировка<br />с тренером</span>
        </SceneButton>
      </section>
      <div ref={offer}><ApproachCard begin={begin} /></div>
      <section className="club-calendar" aria-labelledby="home-calendar-title">
        <h2 id="home-calendar-title">
          <SceneButton type="button" className="club-section-link" onActivate={calendar}>
            Мой календарь <Icon name="chevron" size={20} />
          </SceneButton>
        </h2>
        <Week showAgenda={false} />
        <p className="club-calendar-note">Подбери тренировку</p>
        <TrainingShortcuts training={training} approach={focusOffer} />
      </section>
    </div>
  );
}

export function ClubCalendar({ heading, training, approach }: { heading: Heading; training: TrainingLink; approach: () => void }) {
  return (
    <section className="club-subpage club-calendar">
      <h1 ref={heading} tabIndex={-1}>Мой календарь</h1>
      <Week showAgenda />
      <TrainingShortcuts training={training} approach={approach} />
    </section>
  );
}

export function ClubAction({ heading, begin, training }: { heading: Heading; begin: () => void; training: TrainingLink }) {
  return (
    <section className="club-subpage">
      <h1 ref={heading} tabIndex={-1}>Action</h1>
      <ApproachCard begin={begin} />
      <SceneButton type="button" className="button secondary" onActivate={() => training("smart-start")}>
        Smart Start <Icon name="arrow" />
      </SceneButton>
    </section>
  );
}
