/**
 * About page: app description, tech stack, intelligent feature explanations, and demo accounts.
 */

import styles from './AboutPage.module.css';

const STACK = [
  { layer: 'Frontend', tech: 'React 18 + TypeScript + Vite', note: 'CSS Modules, lazy-loaded routes' },
  { layer: 'Maps', tech: 'Leaflet + OpenStreetMap', note: 'Free, no API key, offline-capable' },
  { layer: 'Charts', tech: 'Recharts', note: 'Analytics bar & pie charts' },
  { layer: 'Backend', tech: 'FastAPI (Python)', note: 'Auto /docs, Pydantic validation, async' },
  { layer: 'Database', tech: 'Supabase (PostgreSQL)', note: 'Cloud DB only — no Supabase Auth' },
  { layer: 'ORM', tech: 'SQLAlchemy 2.x', note: 'Typed models, relationship() joins' },
  { layer: 'Auth', tech: 'Custom JWT + bcrypt', note: 'python-jose, passlib[bcrypt]' },
  { layer: 'Bot Protection', tech: 'Google reCAPTCHA v2', note: 'Registration and reviews' },
];

/**
 * Renders the About page with project and algorithm details for judges.
 */
export default function AboutPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.heroTitle}>Circa</h1>
        <p className={styles.heroSubtitle}>
          A local business discovery platform connecting Arizona communities with independent
          businesses — built for FBLA Coding &amp; Programming.
        </p>
      </header>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About the App</h2>
          <p className={styles.text}>
            Circa helps residents discover, review, and support small and independent
            businesses across Phoenix and Tucson. Users explore 100 real Arizona businesses on an
            interactive Leaflet map, filter by category and rating, save favorites, leave reviews,
            and receive personalized recommendations — all powered by a custom FastAPI backend.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Intelligent Features</h2>

          <div className={styles.featureCard}>
            <h3 className={styles.featureName}>✦ Hidden Gems Algorithm</h3>
            <div className={styles.formula}>
              score = avg_rating × log₁₀(1 + review_count) × recency_factor
            </div>
            <div className={styles.formula}>
              recency_factor = 1 / (1 + days_since_last_review / 30)
            </div>
            <p className={styles.text}>
              Identifies underappreciated businesses by combining three signals: quality (avg
              rating), volume (log scale so no single viral business dominates), and recency (decays
              as the last review gets older). A 4.8-rated business with recent reviews ranks higher
              than a 5.0 with one old review — surfacing actively-loved locals that haven't gone
              mainstream yet.
            </p>
          </div>

          <div className={styles.featureCard}>
            <h3 className={styles.featureName}>★ Content-Based Recommendations</h3>
            <div className={styles.formula}>
              score = (shared_category_count × 2) + avg_rating + (has_active_deal × 1)
            </div>
            <p className={styles.text}>
              Analyzes your saved favorites to build a taste profile. It counts which categories you
              prefer (weighted 2×), factors in business quality, and gives a bonus to businesses with
              active deals. Requires 2+ saved favorites; falls back to Hidden Gems otherwise.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tech Stack</h2>
          <div className={styles.stackTable}>
            {STACK.map(({ layer, tech, note }) => (
              <div key={layer} className={styles.stackRow}>
                <span className={styles.stackLayer}>{layer}</span>
                <span className={styles.stackTech}>{tech}</span>
                <span className={styles.stackNote}>{note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Demo Accounts</h2>
          <div className={styles.accountsGrid}>
            {[
              { role: 'User', creds: 'demo@example.com / Demo1234', color: 'blue' },
              { role: 'Business Owner', creds: 'owner@example.com / Owner1234', color: 'green' },
              { role: 'Admin', creds: 'admin@example.com / Admin1234', color: 'red' },
            ].map(({ role, creds, color }) => (
              <div key={role} className={`${styles.accountCard} ${styles[`account_${color}`]}`}>
                <span className={styles.accountRole}>{role}</span>
                <code className={styles.accountCreds}>{creds}</code>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
