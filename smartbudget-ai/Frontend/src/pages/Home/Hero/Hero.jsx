import styles from "./Hero.module.css";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
      <polyline points="12 5 19 12 12 19" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="6 4 20 12 6 20 6 4" strokeLinejoin="round" />
    </svg>
  );
}

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.bgGradient} />
      <div className={styles.bgGrid} />
      <div className={styles.glowOrb} />

      <div className={styles.inner}>
        {/* Left content */}
        <div className={styles.content}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            AI-Powered Budgeting, Reimagined
          </div>

          <h1 className={styles.heading}>
            Take control of your money with{" "}
            <span className={styles.gradientText}>AI that understands you</span>
          </h1>

          <p className={styles.description}>
            SmartBudget AI analyzes your spending in real time, predicts what's
            coming next, and shows you exactly where to save — so you can stop
            guessing and start growing your savings on autopilot.
          </p>

          <div className={styles.ctaRow}>
            <button type="button" className={styles.ctaPrimary}>
              <span>
                Get Started Free
                <ArrowIcon />
              </span>
            </button>

            <button type="button" className={styles.ctaSecondary}>
              <PlayIcon />
              Watch Demo
            </button>
          </div>

          <div className={styles.trustRow}>
            <div className={styles.avatarStack}>
              <span className={styles.avatar} />
              <span className={styles.avatar} />
              <span className={styles.avatar} />
              <span className={styles.avatar} />
            </div>
            <p className={styles.trustText}>
              Trusted by <strong>12,000+</strong> people managing their money smarter
            </p>
          </div>
        </div>

        {/* Right illustration placeholder */}
        <div className={styles.illustrationWrap}>
          <div className={styles.illustrationGlow} />

          <div className={styles.illustrationCard}>
            <div className={styles.illustrationHeader}>
              <span className={styles.illustrationDot} />
              <span className={styles.illustrationDot} />
              <span className={styles.illustrationDot} />
            </div>

            <div className={styles.illustrationBars}>
              <span className={styles.bar} />
              <span className={styles.bar} />
              <span className={styles.bar} />
              <span className={styles.bar} />
              <span className={styles.bar} />
              <span className={styles.bar} />
            </div>
          </div>

          <div className={`${styles.floatingChip} ${styles.chipTop}`}>
            <span className={styles.chipIcon}>↑</span>
            Savings up 24%
          </div>

          <div className={`${styles.floatingChip} ${styles.chipBottom}`}>
            <span className={styles.chipIcon}>AI</span>
            Smart insights ready
          </div>
        </div>
      </div>
    </section>
  );
}