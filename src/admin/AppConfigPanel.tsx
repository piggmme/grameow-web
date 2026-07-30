import {useEffect, useState} from 'react';
import {api} from './api';

const CONFIG_LABELS: Record<string, string> = {
  min_ios_version: 'iOS 최소 버전',
  min_android_version: 'Android 최소 버전',
};

export default function AppConfigPanel() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, {text: string; ok: boolean}>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getAppConfig();
        setConfig(data);
      } catch (e: any) {
        alert(e?.message || '불러오기 실패');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (key: string) => {
    const value = editValues[key];
    if (value === undefined) return;
    if (!/^\d+\.\d+\.\d+$/.test(value)) {
      setMessages(prev => ({...prev, [key]: {text: '형식: 1.0.0', ok: false}}));
      return;
    }
    setSaving(prev => ({...prev, [key]: true}));
    try {
      await api.updateAppConfig(key, value);
      setConfig(prev => ({...prev, [key]: value}));
      setEditValues(prev => {const n = {...prev}; delete n[key]; return n;});
      setMessages(prev => ({...prev, [key]: {text: '저장됨', ok: true}}));
      setTimeout(() => setMessages(prev => {const n = {...prev}; delete n[key]; return n;}), 2000);
    } catch (e: any) {
      setMessages(prev => ({...prev, [key]: {text: e?.message || '저장 실패', ok: false}}));
    } finally {
      setSaving(prev => ({...prev, [key]: false}));
    }
  };

  if (loading) return <div style={{padding: 32}}>불러오는 중...</div>;

  return (
    <div>
      <h2 style={styles.heading}>앱 설정</h2>
      <p style={styles.desc}>최소 버전 미만의 앱에서는 강제 업데이트 팝업이 표시됩니다. 형식: 1.0.0</p>
      <div style={styles.card}>
        {Object.keys(CONFIG_LABELS).map(key => {
          const isEditing = editValues[key] !== undefined;
          const msg = messages[key];
          return (
            <div key={key} style={styles.row}>
              <div style={styles.label}>{CONFIG_LABELS[key]}</div>
              <div style={styles.inputRow}>
                <input
                  type="text"
                  value={editValues[key] ?? config[key] ?? ''}
                  onChange={e => setEditValues(prev => ({...prev, [key]: e.target.value}))}
                  style={styles.input}
                  placeholder="0.0.0"
                />
                {isEditing && (
                  <button
                    onClick={() => handleSave(key)}
                    disabled={saving[key]}
                    style={{...styles.saveBtn, opacity: saving[key] ? 0.5 : 1}}>
                    {saving[key] ? '...' : '저장'}
                  </button>
                )}
                {msg && (
                  <span style={{...styles.msg, color: msg.ok ? '#7EB87E' : '#E8917F'}}>
                    {msg.text}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: {fontSize: 20, fontWeight: 700, marginBottom: 8},
  desc: {fontSize: 13, color: '#787370', marginBottom: 24},
  card: {
    background: '#fff',
    border: '1px solid #E8E6E1',
    borderRadius: 8,
    padding: '8px 0',
    maxWidth: 480,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #F0EEE9',
  },
  label: {fontSize: 14, fontWeight: 600, color: '#3D3934', width: 180},
  inputRow: {display: 'flex', alignItems: 'center', gap: 8},
  input: {
    padding: '6px 10px',
    border: '1px solid #E8E6E1',
    borderRadius: 6,
    fontSize: 14,
    width: 100,
  },
  saveBtn: {
    padding: '6px 14px',
    background: '#3D3934',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  msg: {fontSize: 12},
};
