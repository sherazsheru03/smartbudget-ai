import { useRef } from "react";
import styles from "./Features.module.css";

const FEATURES = [
  {
    title: "AI Spending Insights",
    description:
      "SmartBudget AI scans every transaction in real time and surfaces patterns you'd never spot manually — subscriptions creeping up, category overspend, and more.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" strokeLinecap="round" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    title: "Predictive Cash Flow",
    description:
      "See what your balance will look like next week and next month before it happens, with forecasts that adapt as your income and habits change.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 17l5-5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 7h6v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Smart Auto-Categorization",
    description:
      "Every transaction is tagged automatically using AI trained on millions of purchases, so your budget stays accurate without manual entry.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="7" height="7" rx="1.5" />
        <rect x="14" y="4" width="7" height="7" rx="1.5" />
        <rect x="3" y="15" width="7" height="7" rx="1.5" />
        <rect x="14" y="15" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    title: "Bank-Grade Security",
    description:
      "256-bit encryption, read-only bank connections, and zero data selling — your financial data stays private, always under your control.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" strokeLinejoin="round" />
        <path d="M9.5 12l1.8 1.8L15 10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
      <polyline points="12 5 19 12 12 19" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureCard({ title, description, icon }) {
  const cardRef = useRef(null);

  // Tracks mouse position to drive the CSS spotlight (--mx, --my)
  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    card.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div className={styles.card} ref={cardRef} onMouseMove={handleMouseMove}>
      <div className={styles.iconWrap}>{icon}</div>
      <h3 className={styles.cardTitle}>{title}</h3>
      <p className={styles.cardDescription}>{description}</p>
      <span className={styles.cardLink}>
        Learn more <ArrowIcon />
      </span>
    </div>
  );
}

export default function Features() {
  return (
    <section className={styles.features}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            Why SmartBudget AI
          </div>

          <h2 className={styles.title}>
            Everything you need to{" "}
            <span className={styles.gradientText}>master your money</span>
          </h2>

          <p className={styles.subtitle}>
            Powerful AI features designed to give you clarity, control, and
            confidence over your finances — without the spreadsheets.
          </p>
        </div>

        <div className={styles.grid}>
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}