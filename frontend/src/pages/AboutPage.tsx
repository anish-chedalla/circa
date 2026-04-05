/**
 * About page: simple, readable project description for judges and users.
 */

import styles from './AboutPage.module.css';

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>About</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Our Mission</h2>
        <p className={styles.text}>
          Our goal is to make it easier for people to discover and support small, local businesses
          in their communities. Independent businesses often struggle to compete with large chains
          and online marketplaces. By making local businesses easier to find, we hope to help
          communities support the places that make them unique.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>What This Platform Does</h2>
        <p className={styles.text}>
          This platform helps users explore businesses in their area and find new places to visit.
          Users can:
        </p>
        <ul className={styles.list}>
          <li>Discover local businesses by category</li>
          <li>View promotions and special deals</li>
          <li>Read and leave reviews</li>
          <li>Bookmark favorite businesses</li>
          <li>Explore nearby businesses on a map</li>
        </ul>
        <p className={styles.text}>
          These features help users quickly find places that match their interests while
          supporting businesses in their community.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Why Local Businesses Matter</h2>
        <p className={styles.text}>
          Local businesses play an important role in shaping communities. They create jobs,
          support local economies, and provide unique products and services that larger chains
          often cannot offer. When people support local businesses, more money stays within the
          community and helps it grow.
        </p>
        <p className={styles.text}>
          Our platform aims to strengthen this connection by making local businesses easier to
          discover.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Our Goal</h2>
        <p className={styles.text}>
          We want to make discovering small businesses simple and accessible. Whether someone is
          looking for a new restaurant, a local shop, or a service nearby, this platform helps
          connect people with businesses in their community.
        </p>
        <p className={styles.text}>
          By improving visibility for local businesses, we hope to encourage people to explore and
          support the places around them.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>About the Project</h2>
        <p className={styles.text}>
          This application was developed as part of the FBLA Coding &amp; Programming competition.
          The goal of the project is to create a practical tool that helps people discover and
          support small businesses in their communities while demonstrating strong programming,
          design, and problem-solving skills.
        </p>
      </section>
    </main>
  );
}
