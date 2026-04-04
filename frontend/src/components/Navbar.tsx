/**
 * Top-level navigation bar displayed on every page.
 * Highlights the active route and shows role-specific links.
 */

import { NavLink } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import styles from './Navbar.module.css';

/**
 * Renders the primary navigation bar with links and auth status.
 */
export default function Navbar() {
  const { user, logout } = useAuth();

  /** Return active CSS class for NavLink. */
  function activeClass({ isActive }: { isActive: boolean }) {
    return isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;
  }

  return (
    <nav className={styles.nav}>
      <NavLink to="/" className={styles.brand} end>
        Circa
      </NavLink>

      <ul className={styles.links}>
        <li><NavLink to="/" className={activeClass} end>Map</NavLink></li>
        <li><NavLink to="/analytics" className={activeClass}>Analytics</NavLink></li>
        <li><NavLink to="/about" className={activeClass}>About</NavLink></li>

        {user?.role === 'business_owner' && (
          <li><NavLink to="/owner/dashboard" className={activeClass}>Dashboard</NavLink></li>
        )}
        {user?.role === 'admin' && (
          <>
            <li><NavLink to="/owner/dashboard" className={activeClass}>Owner</NavLink></li>
            <li><NavLink to="/admin" className={activeClass}>Admin</NavLink></li>
          </>
        )}

        {!user && (
          <>
            <li><NavLink to="/login" className={activeClass}>Login</NavLink></li>
            <li><NavLink to="/register" className={`${styles.navLink} ${styles.registerBtn}`}>Register</NavLink></li>
          </>
        )}

        {user && (
          <li><NavLink to="/profile" className={activeClass}>Profile</NavLink></li>
        )}
      </ul>

      {user && (
        <div className={styles.userSection}>
          <span className={`${styles.roleBadge} ${styles[`role_${user.role}`]}`}>
            {user.role.replace('_', ' ')}
          </span>
          <button type="button" className={styles.logoutBtn} onClick={logout}>
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
