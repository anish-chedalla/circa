/**
 * About page: project description with hero section, logo, and purple/white theme.
 */

import styles from './AboutPage.module.css';

export default function AboutPage() {
  return (
    <main className={styles.page}>
      {/* Header with logo */}
      <div className={styles.headerLogo}>
        <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" stroke="#7c3aed" strokeWidth="3"/>
          <text x="50" y="60" fontSize="48" fontWeight="bold" textAnchor="middle" fill="#7c3aed">C</text>
        </svg>
      </div>

      {/* Black translucent hero section */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Circa</h1>
        <p className={styles.heroMeaning}>Around</p>
        <p className={styles.heroSubtitle}>
          Showing dedication to local businesses and community support
        </p>
      </section>

      {/* Mission Section */}
      <section className={styles.section}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionImage}>
            <img
              src="/images/about_page/small_business.jpg"
              alt="Community support"
            />
          </div>
          <div className={styles.sectionContent}>
            <h2 className={styles.sectionTitle}>Our Mission</h2>
            <p className={styles.text}>
              Our goal is to make it easier for people to discover and support small, local
              businesses in their communities. Independent businesses often struggle to compete
              with large chains and online marketplaces. By making local businesses easier to
              find, we hope to help communities support the places that make them unique.
            </p>
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section className={styles.section}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionContent}>
            <h2 className={styles.sectionTitle}>What This Platform Does</h2>
            <p className={styles.text}>
              This platform helps users explore businesses in their area and find new places to
              visit. Users can:
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
          </div>
          <div className={styles.sectionImage}>
            <img
              src="https://images.unsplash.com/photo-1460925895917-adf4e0e49bfd?w=600&h=400&fit=crop"
              alt="Business discovery"
            />
          </div>
        </div>
      </section>

      {/* Why Local Matters Section */}
      <section className={styles.section}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionImage}>
            <img
              src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop"
              alt="Local business community"
            />
          </div>
          <div className={styles.sectionContent}>
            <h2 className={styles.sectionTitle}>Why Local Businesses Matter</h2>
            <p className={styles.text}>
              Local businesses play an important role in shaping communities. They create jobs,
              support local economies, and provide unique products and services that larger chains
              often cannot offer. When people support local businesses, more money stays within
              the community and helps it grow.
            </p>
            <p className={styles.text}>
              Our platform aims to strengthen this connection by making local businesses easier to
              discover.
            </p>
          </div>
        </div>
      </section>

      {/* Our Goal Section */}
      <section className={styles.section}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionContent}>
            <h2 className={styles.sectionTitle}>Our Goal</h2>
            <p className={styles.text}>
              We want to make discovering small businesses simple and accessible. Whether someone
              is looking for a new restaurant, a local shop, or a service nearby, this platform
              helps connect people with businesses in their community.
            </p>
            <p className={styles.text}>
              By improving visibility for local businesses, we hope to encourage people to explore
              and support the places around them.
            </p>
          </div>
          <div className={styles.sectionImage}>
            <img
              src="https://images.unsplash.com/photo-1552664730-d307cb007067?w=600&h=400&fit=crop"
              alt="Supporting small businesses"
            />
          </div>
        </div>
      </section>

      {/* About Project Section */}
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
