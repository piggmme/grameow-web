import {useEffect, useState} from 'react';
import {api} from './api';

const ROLES = ['USER', 'PAID', 'TESTER', 'ADMIN'] as const;
const ROLE_LABEL: Record<string, string> = {
  USER: '일반',
  PAID: '결제',
  TESTER: '테스터',
  ADMIN: '어드민',
};

export default function UserDetail({id}: {id: number}) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getUser(id);
      setUser(res);
    } catch (err: any) {
      alert(err?.message || '조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    if (!confirm(`권한을 ${ROLE_LABEL[newRole]}(으)로 변경할까요?`)) {
      e.target.value = user.role;
      return;
    }
    setSaving(true);
    try {
      await api.updateRole(id, newRole);
      await load();
    } catch (err: any) {
      alert(err?.message || '변경 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleResetProgress = async () => {
    if (!confirm('이 사용자의 모든 학습 기록을 초기화할까요? 되돌릴 수 없습니다.')) return;
    try {
      await api.resetProgress(id);
      alert('초기화되었습니다.');
      await load();
    } catch (err: any) {
      alert(err?.message || '실패');
    }
  };

  const handleDelete = async () => {
    if (!confirm('이 사용자를 삭제할까요? (soft delete)')) return;
    try {
      await api.deleteUser(id);
      alert('삭제되었습니다.');
      window.location.href = '/admin/users';
    } catch (err: any) {
      alert(err?.message || '실패');
    }
  };

  if (loading) return <div style={{padding: 32}}>로딩 중...</div>;
  if (!user) return <div style={{padding: 32}}>사용자를 찾을 수 없습니다.</div>;

  return (
    <div>
      <a href="/admin/users" style={styles.back}>← 사용자 목록</a>
      <h2 style={styles.title}>{user.nickname || user.email}</h2>

      <div style={styles.grid}>
        <Card title="기본 정보">
          <Row label="ID" value={user.id} />
          <Row label="이메일" value={user.email} />
          <Row label="닉네임" value={user.nickname || '-'} />
          <Row label="로그인 방식" value={user.loginType} />
          <Row label="가입일" value={user.createdAt?.slice(0, 19).replace('T', ' ')} />
        </Card>

        <Card title="학습 현황">
          <Row label="레벨" value={user.level || '-'} />
          <Row label="Streak" value={`${user.streakCount}일`} />
          <Row label="최근 학습일" value={user.lastStudyDate || '-'} />
          <Row label="완료 레슨" value={user.stats.completedLessons} />
          <Row
            label="카드 정답률"
            value={`${user.stats.accuracy}% (${user.stats.correctCount}/${user.stats.totalCardResults})`}
          />
        </Card>

        <Card title="권한 관리">
          <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
            <select
              value={user.role}
              onChange={handleRoleChange}
              disabled={saving}
              style={styles.select}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]} ({r})
                </option>
              ))}
            </select>
            {saving && <span style={{fontSize: 12, color: '#787370'}}>저장 중...</span>}
          </div>
        </Card>

        <Card title="위험 작업" tone="danger">
          <button onClick={handleResetProgress} style={styles.dangerBtn}>
            학습 기록 초기화
          </button>
          <button onClick={handleDelete} style={{...styles.dangerBtn, marginTop: 8}}>
            사용자 삭제 (soft delete)
          </button>
        </Card>
      </div>
    </div>
  );
}

function Card({title, tone, children}: {title: string; tone?: 'danger'; children: React.ReactNode}) {
  return (
    <div
      style={{
        ...styles.card,
        borderColor: tone === 'danger' ? '#E8735A50' : '#E8E6E1',
      }}>
      <div
        style={{
          ...styles.cardTitle,
          color: tone === 'danger' ? '#E8735A' : '#3D3934',
        }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({label, value}: {label: string; value: React.ReactNode}) {
  return (
    <div style={styles.row}>
      <div style={styles.rowLabel}>{label}</div>
      <div style={styles.rowValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  back: {
    display: 'inline-block',
    marginBottom: 12,
    color: '#787370',
    textDecoration: 'none',
    fontSize: 13,
  },
  title: {margin: 0, marginBottom: 20, fontSize: 24},
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#fff',
    border: '1px solid',
    borderRadius: 12,
    padding: 20,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 12,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: 13,
    gap: 12,
  },
  rowLabel: {color: '#787370'},
  rowValue: {color: '#3D3934', textAlign: 'right'},
  select: {
    padding: '8px 12px',
    border: '1px solid #E8E6E1',
    borderRadius: 6,
    fontSize: 13,
    background: '#fff',
    flex: 1,
  },
  dangerBtn: {
    width: '100%',
    padding: '10px 14px',
    background: '#fff',
    color: '#E8735A',
    border: '1px solid #E8735A',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 600,
  },
};
