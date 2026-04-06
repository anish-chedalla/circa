import styles from './AboutPage.module.css';
import anishImage from '../assets/founder-pics/Anish.jpeg';
import adhyyanImage from '../assets/founder-pics/Adhyyan.jpeg';
import gauriImage from '../assets/founder-pics/Gauri2.jpeg';

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
    image: anishImage,
    position: '50% 48%',
    quote:
      'We built Circa because so many incredible local businesses go unnoticed. Technology should make communities more connected, not more distant. Circa helps people discover the places around them that make their neighborhoods unique.',
  },
  {
    name: 'Gauri Gulati',
    title: 'Founder',
    image: gauriImage,
    position: '90% 38%',
    quote:
      'Communities are built through shared spaces, local shops, and everyday interactions. Circa was created to strengthen those connections by helping people explore their surroundings and engage with the businesses that shape their neighborhoods.',
  },
  {
    name: 'Adhyyan Ranjan',
    title: 'Founder',
    image: adhyyanImage,
    position: '56% 04%',
    quote:
      'Small businesses are the backbone of every community, but they often struggle to compete with large platforms. Circa is about giving local businesses better visibility and giving people an easier way to support the places around them.',
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
