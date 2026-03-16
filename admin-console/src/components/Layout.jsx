import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../App';

const styles = {
  wrap: { display: 'flex', minHeight: '100vh', flexDirection: 'column' },
  header: {
    background: '#1e293b',
    color: '#fff',
    padding: '0 24px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  logo: { fontWeight: 700, fontSize: 16, letterSpacing: '.5px' },
  nav: { display: 'flex', gap: 8, alignItems: 'center' },
  user: { fontSize: 13, color: '#94a3b8', marginRight: 12 },
  main: { flex: 1, padding: '24px' },
};

export default function Layout() {
  const { username, signOut } = useAuth();

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <span style={styles.logo}>Access Check — Admin</span>
        <nav style={styles.nav}>
          <NavLink to="/people" style={({ isActive }) => ({ color: isActive ? '#60a5fa' : '#cbd5e1', fontSize: 14 })}>
            People
          </NavLink>
          <span style={styles.user}>{username}</span>
          <button className="secondary" onClick={signOut} style={{ padding: '4px 12px', fontSize: 13 }}>
            Logout
          </button>
        </nav>
      </header>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
