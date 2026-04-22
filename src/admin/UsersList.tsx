import {useEffect, useState} from 'react';
import {api, type AdminUser} from './api';

const ROLES = ['', 'USER', 'PAID', 'TESTER', 'ADMIN'];
const ROLE_LABEL: Record<string, string> = {
  USER: '일반',
  PAID: '결제',
  TESTER: '테스터',
  ADMIN: '어드민',
};
const ROLE_BADGE: Record<string, string> = {
  USER: '#E8E6E1',
  PAID: '#7EB87E',
  TESTER: '#6BA3D6',
  ADMIN: '#E8917F',
};

export default function UsersList() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listUsers({search, role, page, pageSize});
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      alert(err?.message || '조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, role]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h2 style={styles.title}>사용자 ({total})</h2>
      <form onSubmit={handleSearch} style={styles.filters}>
        <input
          type="text"
          placeholder="이메일 또는 닉네임 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.input}
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          style={styles.select}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r === '' ? '전체 권한' : ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button type="submit" style={styles.searchBtn}>검색</button>
      </form>

      {loading ? (
        <div style={{padding: 32}}>로딩 중...</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>이메일</th>
              <th style={styles.th}>닉네임</th>
              <th style={styles.th}>레벨</th>
              <th style={styles.th}>권한</th>
              <th style={styles.th}>로그인</th>
              <th style={styles.th}>Streak</th>
              <th style={styles.th}>가입일</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr
                key={u.id}
                style={styles.tr}
                onClick={() => (window.location.href = `/admin/users/detail?id=${u.id}`)}>
                <td style={styles.td}>{u.id}</td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}>{u.nickname || '-'}</td>
                <td style={styles.td}>{u.level || '-'}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      background: ROLE_BADGE[u.role] + '40',
                      borderColor: ROLE_BADGE[u.role],
                    }}>
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td style={styles.td}>{u.loginType}</td>
                <td style={styles.td}>{u.streakCount}</td>
                <td style={styles.td}>{u.createdAt?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={styles.pagination}>
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          style={styles.pageBtn}>
          이전
        </button>
        <span>{page} / {lastPage}</span>
        <button
          onClick={() => setPage(Math.min(lastPage, page + 1))}
          disabled={page >= lastPage}
          style={styles.pageBtn}>
          다음
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {margin: 0, marginBottom: 16, fontSize: 22},
  filters: {display: 'flex', gap: 8, marginBottom: 16},
  input: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #E8E6E1',
    borderRadius: 8,
    fontSize: 14,
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #E8E6E1',
    borderRadius: 8,
    fontSize: 14,
    background: '#fff',
  },
  searchBtn: {
    padding: '10px 16px',
    background: '#3D3934',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    borderBottom: '1px solid #E8E6E1',
    fontSize: 13,
    color: '#787370',
    fontWeight: 600,
  },
  tr: {cursor: 'pointer'},
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid #E8E6E1',
    fontSize: 13,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid',
    fontSize: 12,
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    alignItems: 'center',
    padding: 16,
    fontSize: 13,
  },
  pageBtn: {
    padding: '6px 12px',
    background: '#fff',
    border: '1px solid #E8E6E1',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
  },
};
