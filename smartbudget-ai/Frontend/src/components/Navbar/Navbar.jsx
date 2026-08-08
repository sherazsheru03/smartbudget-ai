import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Navbar.module.css";

const NAV_LINKS = [
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "Insights", to: "/insights" },
  { label: "About", to: "/about" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Toggle glass-scrolled state after 8px of scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Close mobile menu on route change / resize back to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <header className={`${styles.navbar} ${scrolled ? styles.scrolled : ""}`}>
        <div className={styles.inner}>
          {/* Logo */}
          <div className={styles.logoWrap}>
            <NavLink to="/" className={styles.logo} onClick={closeMobile}>
              <span className={styles.logoMark}>SB</span>
              <span className={styles.logoText}>SmartBudget AI</span>
            </NavLink>
          </div>

          {/* Center nav links (desktop) */}
          <nav className={styles.links} aria-label="Primary navigation">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.linkActive}` : styles.link
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Right actions */}
          <div className={styles.actions}>
            <NavLink to="/login" className={styles.signInLink}>
              Sign In
            </NavLink>
            <NavLink to="/get-started" className={styles.ctaButton}>
              <span>Get Started</span>
            </NavLink>

            <button
              type="button"
              className={`${styles.menuToggle} ${mobileOpen ? styles.open : ""}`}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              <span className={styles.hamburgerLine} />
              <span className={styles.hamburgerLine} />
              <span className={styles.hamburgerLine} />
            </button>
          </div>
        </div>

        {/* Mobile panel */}
        <div
          className={`${styles.mobilePanel} ${mobileOpen ? styles.open : ""}`}
          aria-hidden={!mobileOpen}
        >
          <nav aria-label="Mobile navigation">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  isActive
                    ? `${styles.mobileLink} ${styles.mobileLinkActive}`
                    : styles.mobileLink
                }
                onClick={closeMobile}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className={styles.mobileActions}>
            <NavLink to="/login" className={styles.mobileSignIn} onClick={closeMobile}>
              Sign In
            </NavLink>
            <NavLink to="/get-started" className={styles.ctaButton} onClick={closeMobile}>
              <span>Get Started</span>
            </NavLink>
          </div>
        </div>
      </header>

      {/* Spacer to offset content below the fixed navbar */}
      <div style={{ height: "var(--header-height)" }} aria-hidden="true" />
    </>
  );
}