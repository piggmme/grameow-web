import {useState} from 'react';
import {api, setToken} from './api';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const {accessToken} = await api.signin(email, password);
      setToken(accessToken);
      // role 확인
      const me = await api.me();
      if (me.role !== 'ADMIN') {
        setToken(null);
        throw new Error('관리자 권한이 없는 계정입니다.');
      }
      window.location.href = '/admin/users';
    } catch (err: any) {
      setError(err?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h1 style={styles.title}>Grameow 관리자</h1>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          style={styles.input}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
        {error && <div style={styles.error}>{error}</div>}
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F7F6F3',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  form: {
    width: 360,
    padding: 32,
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  title: {
    margin: 0,
    marginBottom: 12,
    fontSize: 22,
    color: '#3D3934',
  },
  input: {
    padding: '12px 14px',
    border: '1px solid #E8E6E1',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
  },
  button: {
    padding: '12px 14px',
    background: '#3D3934',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    padding: 10,
    background: '#FDECEA',
    color: '#E8735A',
    borderRadius: 8,
    fontSize: 13,
  },
};
