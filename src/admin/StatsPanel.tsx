import {useEffect, useState} from 'react';
import {api} from './api';

type Stats = Awaited<ReturnType<typeof api.getActiveUserStats>>;

const RANGES = [
  {label: '7일', days: 7},
  {label: '30일', days: 30},
  {label: '90일', days: 90},
];

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getActiveUserStats(days)
      .then((res) => {
        if (active) setStats(res);
      })
      .catch((err) => alert(err?.message || '통계 조회 실패'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days]);

  const maxActive = stats
    ? Math.max(1, ...stats.daily.map((d) => d.activeUsers))
    : 1;
  const signupByDate = new Map(
    stats?.signups.map((s) => [s.date, s.count]) ?? [],
  );

  return (
    <div>
      <div style={styles.titleRow}>
        <h2 style={styles.title}>활성 유저 통계</h2>
        <div style={styles.rangeBtns}>
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              style={{
                ...styles.rangeBtn,
                ...(days === r.days ? styles.rangeBtnActive : {}),
              }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !stats ? (
        <div style={{padding: 32}}>로딩 중...</div>
      ) : (
        <>
          <div style={styles.kpiRow}>
            <Kpi label="전체 가입자" value={stats.totalUsers} />
            <Kpi label="DAU (오늘)" value={stats.dau} accent="#7EB87E" />
            <Kpi label="WAU (7일)" value={stats.wau} accent="#6BA3D6" />
            <Kpi label="MAU (30일)" value={stats.mau} accent="#E8917F" />
          </div>

          <div style={styles.card}>
            <div style={styles.cardTitle}>일별 활성 유저 · 신규 가입</div>
            <div style={styles.chart}>
              {stats.daily.map((d) => {
                const h = Math.round((d.activeUsers / maxActive) * 140);
                const signups = signupByDate.get(d.date) ?? 0;
                return (
                  <div key={d.date} style={styles.barCol} title={`${d.date}\n활성 ${d.activeUsers}명 · 신규 ${signups}명`}>
                    <span style={styles.barValue}>{d.activeUsers}</span>
                    <div style={{...styles.bar, height: h}} />
                    <span style={styles.barSignup}>{signups > 0 ? `+${signups}` : ''}</span>
                    <span style={styles.barDate}>{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
            <div style={styles.legend}>
              막대 = 활성 유저 수 · <span style={{color: '#7EB87E'}}>+N</span> = 신규 가입 · 활동 기준: 카드 풀기/수업 완료 (KST)
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({label, value, accent}: {label: string; value: number; accent?: string}) {
  return (
    <div style={styles.kpi}>
      <div style={{...styles.kpiValue, color: accent ?? '#3D3934'}}>{value.toLocaleString()}</div>
      <div style={styles.kpiLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  titleRow: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16},
  title: {margin: 0, fontSize: 22},
  rangeBtns: {display: 'flex', gap: 6},
  rangeBtn: {
    padding: '6px 14px',
    background: '#fff',
    border: '1px solid #E8E6E1',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
  },
  rangeBtnActive: {background: '#3D3934', color: '#fff', borderColor: '#3D3934'},
  kpiRow: {display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap'},
  kpi: {
    flex: 1,
    minWidth: 120,
    background: '#fff',
    border: '1px solid #E8E6E1',
    borderRadius: 10,
    padding: '18px 20px',
  },
  kpiValue: {fontSize: 28, fontWeight: 700},
  kpiLabel: {fontSize: 13, color: '#787370', marginTop: 4},
  card: {background: '#fff', border: '1px solid #E8E6E1', borderRadius: 10, padding: 20},
  cardTitle: {fontSize: 14, fontWeight: 600, marginBottom: 16},
  chart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 3,
    overflowX: 'auto',
    paddingBottom: 4,
    minHeight: 190,
  },
  barCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 22,
    gap: 2,
  },
  barValue: {fontSize: 9, color: '#787370'},
  bar: {width: 14, background: '#7EB87E', borderRadius: 3, minHeight: 2},
  barSignup: {fontSize: 9, color: '#7EB87E', height: 12},
  barDate: {fontSize: 9, color: '#A8A29E', writingMode: 'vertical-rl', marginTop: 2},
  legend: {marginTop: 12, fontSize: 12, color: '#787370'},
};
