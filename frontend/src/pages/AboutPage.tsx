import styles from './AboutPage.module.css';

const steps = [
  {
    number: '1',
    title: 'Discover Local Businesses',
    description:
      'Explore independent shops, restaurants, and services in your area. Circa surfaces the places that make communities unique.',
  },
  {
    number: '2',
    title: 'Connect With Your Community',
    description:
      'Save favorite places, read reviews, and discover recommendations from people nearby.',
  },
  {
    number: '3',
    title: "Support What's Around You",
    description:
      'By helping people find local businesses and opportunities, Circa strengthens the communities around us.',
  },
];

const teamMembers = [
  {
    name: 'Anish Chedalla',
    title: 'Founder',
    image: '/founder-pics/Anish.jpeg',
    position: '50% 28%',
    quote:
      'We built Circa because we love helping people discover and support the local communities around them.',
  },
  {
    name: 'Adhyyan Ranjan',
    title: 'Founder',
    image: '/founder-pics/Adhyyan.jpeg',
    position: '56% 44%',
    quote:
      'We built Circa because we love helping people discover and support the local communities around them.',
  },
  {
    name: 'Gauri Gulati',
    title: 'Founder',
    image: '/founder-pics/Gauri.jpeg',
    position: '42% 38%',
    quote:
      'We built Circa because we love helping people discover and support the local communities around them.',
  },
];

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="about-hero-title">
        <div className={styles.heroBackdrop} aria-hidden="true" />
        <div className={styles.heroOverlay} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroStatement}>
            Community. Connection. Commitment.
          </p>
          <h1 id="about-hero-title" className={styles.heroTitle}>
            Circa
          </h1>
          <p className={styles.definition}>
            (n.) derived from Latin meaning around, round about, on all sides.
          </p>
        </div>
      </section>

      <section className={styles.processSection} aria-labelledby="community-heading">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>The Circa Experience</p>
            <div className={styles.kickerUnderline} aria-hidden="true" />
          </div>

          <div className={styles.stepsGrid}>
            {steps.map((step) => (
              <article key={step.number} className={styles.step}>
                <span className={styles.stepNumber}>{step.number}</span>
                <div className={styles.stepUnderline} aria-hidden="true" />
                <h2 id={step.number === '1' ? 'community-heading' : undefined} className={styles.stepTitle}>
                  {step.title}
                </h2>
                <p className={styles.stepText}>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.contentSection} aria-labelledby="content-title">
        <div className={styles.container}>
          <div className={styles.contentGrid}>
            <div className={styles.contentHeading}>
              <p className={styles.kicker}>Community</p>
              <div className={styles.kickerUnderline} aria-hidden="true" />
              <h2 id="content-title" className={styles.contentTitle}>
                Circa and Community Discovery
              </h2>
            </div>

            <div className={styles.contentBody}>
              <p>
                Circa is designed to help people explore the communities around
                them by making it easier to discover independent businesses and
                local opportunities. Many small businesses struggle to gain
                visibility despite being essential parts of their neighborhoods.
              </p>
              <p>
                By creating a platform focused on discovery and connection,
                Circa helps users find places nearby while giving small
                businesses a way to reach new customers and grow within their
                communities.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.teamSection} aria-labelledby="team-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>Our Team</p>
            <div className={styles.kickerUnderline} aria-hidden="true" />
          </div>

          <h2 id="team-title" className={styles.teamTitle}>
            The Architects Behind Circa
          </h2>

          <div className={styles.teamGrid}>
            {teamMembers.map((member) => (
              <article key={member.name} className={styles.teamCard}>
                <img
                  src={member.image}
                  alt={member.name}
                  className={styles.teamImage}
                  style={{ objectPosition: member.position }}
                />
                <h3 className={styles.memberName}>{member.name}</h3>
                <p className={styles.memberTitle}>{member.title}</p>
                <p className={styles.memberQuote}>{member.quote}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
