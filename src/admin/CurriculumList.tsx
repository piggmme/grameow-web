import {useEffect, useMemo, useState} from 'react';
import {api, type AdminChapter} from './api';

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: '초급',
  INTERMEDIATE: '중급',
  ADVANCED: '고급',
};
const LEVEL_COLOR: Record<string, string> = {
  BEGINNER: '#7EB87E',
  INTERMEDIATE: '#6BA3D6',
  ADVANCED: '#E8917F',
};
const LEVEL_ORDER = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

export default function CurriculumList() {
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState<{id: number; text: string; ok: boolean} | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const data = await api.listChapters();
        setChapters(data);
      } catch (e: any) {
        alert(e?.message || '불러오기 실패');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    return LEVEL_ORDER.map(level => ({
      level,
      items: chapters.filter(ch => ch.level === level),
    }));
  }, [chapters]);

  const handleSave = async (id: number) => {
    const raw = editValues[id];
    if (raw === undefined) return;
    const displayOrder = parseInt(raw, 10);
    if (isNaN(displayOrder) || displayOrder < 1) {
      setMessage({id, text: '1 이상의 숫자를 입력하세요.', ok: false});
      return;
    }
    setSaving(prev => ({...prev, [id]: true}));
    try {
      const updated = await api.updateChapterDisplayOrder(id, displayOrder);
      setChapters(prev => prev.map(ch => ch.id === id ? {...ch, displayOrder: updated.displayOrder} : ch));
      setEditValues(prev => {const n = {...prev}; delete n[id]; return n;});
      setMessage({id, text: '저장됨', ok: true});
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setMessage({id, text: e?.message || '저장 실패', ok: false});
    } finally {
      setSaving(prev => ({...prev, [id]: false}));
    }
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => ({...prev, [id]: !prev[id]}));
  };

  if (loading) return <div style={{padding: 32}}>불러오는 중...</div>;

  return (
    <div>
      <h2 style={styles.heading}>커리큘럼 챕터 순서 관리</h2>
      <p style={styles.desc}>displayOrder는 앱 커리큘럼 화면에서 표시되는 레벨 내 번호입니다.</p>
      {grouped.map(({level, items}) => (
        <div key={level} style={styles.group}>
          <div style={{...styles.levelBadge, background: LEVEL_COLOR[level]}}>
            {LEVEL_LABEL[level]}
          </div>
          <table style={styles.table}>
            <thead>
              <tr style={styles.theadRow}>
                <th style={{...styles.th, width: 28}}></th>
                <th style={styles.th}>슬러그</th>
                <th style={styles.th}>챕터명</th>
                <th style={{...styles.th, width: 90}}>표시 번호</th>
                <th style={{...styles.th, width: 90}}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(ch => {
                const isEditing = editValues[ch.id] !== undefined;
                const isSaving = saving[ch.id];
                const msg = message?.id === ch.id ? message : null;
                const isOpen = expanded[ch.id];
                const totalLessons = ch.stages?.reduce((s, st) => s + (st.lessons?.length ?? 0), 0) ?? 0;
                return (
                  <>
                    <tr key={ch.id} style={styles.tr}>
                      <td style={{...styles.td, textAlign: 'center'}}>
                        <button onClick={() => toggleExpand(ch.id)} style={styles.expandBtn}>
                          {isOpen ? '▾' : '▸'}
                        </button>
                      </td>
                      <td style={styles.td}><span style={styles.slug}>{ch.slug}</span></td>
                      <td style={styles.td}>
                        <span>{ch.title}</span>
                        <span style={styles.lessonCount}> ({ch.stages?.length ?? 0}스테이지 · {totalLessons}레슨)</span>
                      </td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          min={1}
                          value={editValues[ch.id] ?? String(ch.displayOrder)}
                          onChange={e => setEditValues(prev => ({...prev, [ch.id]: e.target.value}))}
                          style={styles.input}
                        />
                      </td>
                      <td style={styles.td}>
                        {isEditing && (
                          <button
                            onClick={() => handleSave(ch.id)}
                            disabled={isSaving}
                            style={{...styles.saveBtn, opacity: isSaving ? 0.5 : 1}}>
                            {isSaving ? '...' : '저장'}
                          </button>
                        )}
                        {msg && (
                          <span style={{...styles.msgText, color: msg.ok ? '#7EB87E' : '#E8917F'}}>
                            {msg.text}
                          </span>
                        )}
                      </td>
                    </tr>
                    {isOpen && ch.stages?.map(stage => (
                      <>
                        <tr key={`stage-${stage.id}`} style={styles.stageTr}>
                          <td style={styles.td}></td>
                          <td style={styles.td} colSpan={4}>
                            <span style={styles.stageLabel}>📂 {stage.title}</span>
                          </td>
                        </tr>
                        {stage.lessons?.map(lesson => (
                          <tr key={`lesson-${lesson.id}`} style={styles.lessonTr}>
                            <td style={styles.td}></td>
                            <td style={styles.td}><span style={styles.slug}>{lesson.slug}</span></td>
                            <td style={styles.td} colSpan={3}>
                              <span style={styles.lessonTitle}>{lesson.title}</span>
                            </td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: {fontSize: 20, fontWeight: 700, marginBottom: 8},
  desc: {fontSize: 13, color: '#787370', marginBottom: 24},
  group: {marginBottom: 32},
  levelBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 8,
  },
  table: {width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #E8E6E1'},
  theadRow: {background: '#F7F6F3'},
  th: {padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#787370', borderBottom: '1px solid #E8E6E1'},
  tr: {borderBottom: '1px solid #F0EEE9'},
  stageTr: {background: '#F7F6F3', borderBottom: '1px solid #F0EEE9'},
  lessonTr: {background: '#FAFAF8', borderBottom: '1px solid #F5F3F0'},
  td: {padding: '10px 14px', fontSize: 13, verticalAlign: 'middle'},
  slug: {fontFamily: 'monospace', color: '#787370', fontSize: 12},
  lessonCount: {fontSize: 12, color: '#aaa'},
  stageLabel: {fontSize: 13, fontWeight: 600, color: '#3D3934'},
  lessonTitle: {fontSize: 12, color: '#555', paddingLeft: 16},
  input: {
    width: 60,
    padding: '4px 8px',
    border: '1px solid #E8E6E1',
    borderRadius: 6,
    fontSize: 13,
    textAlign: 'center' as const,
  },
  saveBtn: {
    padding: '4px 12px',
    background: '#3D3934',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  msgText: {fontSize: 12, marginLeft: 8},
  expandBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: '#787370',
    padding: '2px 4px',
  },
};
