import { Link } from 'react-router-dom';

import styles from './PromoteBusinessPage.module.css';

export default function PromoteBusinessPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <p className={styles.kicker}>Promote Your Business</p>
          <div className={styles.kickerUnderline} aria-hidden="true" />
          <h1 className={styles.title}>Get your business discovered on Circa</h1>
          <p className={styles.lead}>
            Create a business-owner account, submit your listing details, and let our admin team
            approve your listing before it goes live.
          </p>
        </div>
      </section>

      <section className={styles.stepsSection}>
        <div className={styles.container}>
          <div className={styles.stepsGrid}>
            <article className={styles.step}>
              <span className={styles.stepNumber}>1</span>
              <h2>Create a Business Account</h2>
              <p>Sign up as a business owner so you can submit and manage your listing.</p>
            </article>
            <article className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <h2>Submit Your Listing</h2>
              <p>Add your business description, hours, location, and contact details.</p>
            </article>
            <article className={styles.step}>
              <span className={styles.stepNumber}>3</span>
              <h2>Admin Review</h2>
              <p>Our admin panel reviews the listing. Once approved, it appears on the map.</p>
            </article>
          </div>

          <div className={styles.actions}>
            <Link to="/business-register" className={styles.primaryAction}>Create Business Account</Link>
            <Link to="/login" className={styles.secondaryAction}>Owner Login</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
