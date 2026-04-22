import {useEffect, useState} from 'react';
import {api, getToken, setToken} from './api';

export default function AdminLayout({children}: {children: React.ReactNode}) {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    (async () => {
      const t = getToken();
      if (!t) {
        window.location.href = '/admin/login';
        return;
      }
      try {
        const me = await api.me();
        if (me.role !== 'ADMIN') {
          setToken(null);
          window.location.href = '/admin/login';
          return;
        }
        setEmail(me.email);
        setReady(true);
      } catch {
        setToken(null);
        window.location.href = '/admin/login';
      }
    })();
  }, []);

  const handleLogout = () => {
    setToken(null);
    window.location.href = '/admin/login';
  };

  if (!ready) {
    return <div style={{padding: 32, fontFamily: 'system-ui'}}>확인 중...</div>;
  }

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <a href="/admin/users" style={styles.brandLink}>Grameow Admin</a>
        </div>
        <nav style={styles.nav}>
          <a href="/admin/users" style={styles.navLink}>사용자</a>
        </nav>
        <div style={styles.userBox}>
          <span style={styles.userEmail}>{email}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>로그아웃</button>
        </div>
      </header>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    background: '#F7F6F3',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#3D3934',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 24px',
    background: '#fff',
    borderBottom: '1px solid #E8E6E1',
    gap: 24,
  },
  brand: {fontWeight: 700, fontSize: 16},
  brandLink: {color: '#3D3934', textDecoration: 'none'},
  nav: {display: 'flex', gap: 16, flex: 1},
  navLink: {color: '#3D3934', textDecoration: 'none', fontSize: 14},
  userBox: {display: 'flex', alignItems: 'center', gap: 12},
  userEmail: {fontSize: 13, color: '#787370'},
  logoutBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid #E8E6E1',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  main: {padding: 24},
};
