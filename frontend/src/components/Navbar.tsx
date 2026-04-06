/**
 * Top-level navigation bar displayed on every page.
 * Highlights the active route and shows role-specific links.
 * Renders an optional injected slot row (used by MapDiscovery for filters).
 */

import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { useNavbarSlot } from '../context/NavbarSlotContext';
import styles from './Navbar.module.css';

/**
 * Renders the primary navigation bar with links, auth status, and optional slot row.
 */
export default function Navbar() {
  const { user, logout } = useAuth();
  const { slot } = useNavbarSlot();
  const location = useLocation();
  const isOwnerWorkspace = location.pathname.startsWith('/owner/');
  const isAdminWorkspace = location.pathname.startsWith('/admin');
  const isMapRoute = location.pathname === '/' && !isOwnerWorkspace;
  const canUseOwnerWorkspace = user?.role === 'business_owner' || user?.role === 'admin';
  const [showMapTopNav, setShowMapTopNav] = useState(false);

  useEffect(() => {
    setShowMapTopNav(false);
  }, [isMapRoute]);

  /** Return active CSS class for NavLink. */
  function activeClass({ isActive }: { isActive: boolean }) {
    return isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;
  }

  return (
    <nav
      className={`${styles.nav} ${isMapRoute ? styles.mapNav : ''} ${
        isMapRoute && showMapTopNav ? styles.mapNavVisible : ''
      }`}
      onMouseEnter={() => {
        if (isMapRoute) setShowMapTopNav(true);
      }}
      onMouseLeave={() => {
        if (isMapRoute) setShowMapTopNav(false);
      }}
      onFocusCapture={() => {
        if (isMapRoute) setShowMapTopNav(true);
      }}
      onBlurCapture={(event) => {
        if (!isMapRoute) return;
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.contains(next)) {
          setShowMapTopNav(false);
        }
      }}
    >
      {isMapRoute && (
        <div
          className={styles.hoverZone}
          onMouseEnter={() => setShowMapTopNav(true)}
          aria-hidden="true"
        />
      )}

      <div className={styles.headerGroup}>
        <div className={styles.topRow}>
          <NavLink
            to={isOwnerWorkspace ? '/owner/dashboard' : isAdminWorkspace ? '/admin' : '/'}
            className={styles.brand}
            end
          >
            <img src="/circa_c_icon_gap90.svg" alt="" className={styles.brandIcon} />
            <span className={styles.brandWord}>Circa</span>
            {isOwnerWorkspace && <span className={styles.ownerTag}>for Owners</span>}
            {isAdminWorkspace && <span className={styles.adminTag}>Admin</span>}
          </NavLink>

          {!isOwnerWorkspace && !isAdminWorkspace && (
            <ul className={styles.links}>
              <li><NavLink to="/" className={activeClass} end>Map</NavLink></li>
              <li><NavLink to="/analytics" className={activeClass}>Analytics</NavLink></li>
              <li><NavLink to="/about" className={activeClass}>About</NavLink></li>
              <li><NavLink to="/promote-business" className={activeClass}>Promote your business</NavLink></li>

              {canUseOwnerWorkspace && (
                <li><NavLink to="/owner/dashboard" className={activeClass}>Dashboard</NavLink></li>
              )}

              {user?.role === 'admin' && (
                <li><NavLink to="/admin" className={activeClass}>Admin</NavLink></li>
              )}

              {user && (
                <li><NavLink to="/profile" className={activeClass}>Profile</NavLink></li>
              )}

              {!user && (
                <li><NavLink to="/login" className={activeClass}>Login</NavLink></li>
              )}
            </ul>
          )}

          {user && (
            <div className={`${styles.userSection} ${isOwnerWorkspace || isAdminWorkspace ? styles.ownerActions : ''}`}>
              {isOwnerWorkspace && (
                <NavLink to="/" className={`${styles.navLink} ${styles.userViewBtn}`}>
                  Back to user view
                </NavLink>
              )}
              <button type="button" className={styles.logoutBtn} onClick={logout}>
                Logout
              </button>
            </div>
          )}
        </div>

        {slot && <div className={styles.slotRow}>{slot}</div>}
      </div>
    </nav>
  );
}
