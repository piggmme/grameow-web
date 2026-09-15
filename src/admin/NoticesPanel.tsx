import {useEffect, useState} from 'react';
import {api, type AdminNotice} from './api';
import {renderMd} from './markdown';

type Draft = {title: string; content: string; published: boolean};
const EMPTY: Draft = {title: '', content: '', published: true};

export default function NoticesPanel() {
  const [items, setItems] = useState<AdminNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await api.listNotices());
    } catch (e: any) {
      alert(e?.message || '조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setDraft(EMPTY);
    setEditing('new');
  };

  const startEdit = (n: AdminNotice) => {
    setDraft({title: n.title, content: n.content, published: n.published});
    setEditing(n.id);
  };

  const cancel = () => {
    setEditing(null);
    setDraft(EMPTY);
  };

  const save = async () => {
    if (!draft.title.trim() || !draft.content.trim()) {
      alert('제목과 내용을 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      if (editing === 'new') {
        await api.createNotice(draft);
      } else if (typeof editing === 'number') {
        await api.updateNotice(editing, draft);
      }
      cancel();
      await load();
    } catch (e: any) {
      alert(e?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('이 공지를 삭제할까요?')) return;
    try {
      await api.deleteNotice(id);
      await load();
    } catch (e: any) {
      alert(e?.message || '삭제 실패');
    }
  };

  return (
    <div>
      <style>{PREVIEW_CSS}</style>
      <div style={s.titleRow}>
        <h2 style={s.title}>공지사항 ({items.length})</h2>
        {editing === null && (
          <button style={s.addBtn} onClick={startNew}>+ 새 공지</button>
        )}
      </div>

      {editing !== null && (
        <div style={s.editor}>
          <input
            style={s.input}
            placeholder="제목"
            value={draft.title}
            onChange={(e) => setDraft({...draft, title: e.target.value})}
          />
          <div style={s.editorBody}>
            <textarea
              style={s.textarea}
              placeholder="내용 (마크다운 지원: # 제목, **굵게**, - 목록, | 표 |)"
              value={draft.content}
              onChange={(e) => setDraft({...draft, content: e.target.value})}
            />
            <div
              className="md-preview"
              style={s.preview}
              dangerouslySetInnerHTML={{__html: renderMd(draft.content) || '<p style="color:#A8A29E">미리보기</p>'}}
            />
          </div>
          <div style={s.editorFooter}>
            <label style={s.checkboxLabel}>
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft({...draft, published: e.target.checked})}
              />
              발행 (체크 해제 시 임시저장, 앱/웹에 안 보임)
            </label>
            <div style={{flex: 1}} />
            <button style={s.cancelBtn} onClick={cancel} disabled={saving}>취소</button>
            <button style={s.saveBtn} onClick={save} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{padding: 32}}>로딩 중...</div>
      ) : items.length === 0 && editing === null ? (
        <div style={s.empty}>아직 공지가 없습니다. "새 공지"로 작성하세요.</div>
      ) : (
        <div style={s.list}>
          {items.map((n) => (
            <div key={n.id} style={s.listItem}>
              <div style={{flex: 1}}>
                <div style={s.itemTitle}>
                  {n.title}
                  {!n.published && <span style={s.draftBadge}>임시저장</span>}
                </div>
                <div style={s.itemDate}>{n.createdAt?.slice(0, 10)}</div>
              </div>
              <button style={s.editBtn} onClick={() => startEdit(n)}>수정</button>
              <button style={s.delBtn} onClick={() => remove(n.id)}>삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PREVIEW_CSS = `
.md-preview p { margin: 0 0 10px; color: #3D3934; font-size: 14px; line-height: 1.7; }
.md-preview strong { color: #6BA3D6; font-weight: 700; }
.md-preview code { background: #F0EEE9; color: #3D3934; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
.md-preview table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
.md-preview th { background: #F7F6F3; color: #787370; padding: 6px 10px; text-align: left; border: 1px solid #E8E6E1; font-weight: 600; }
.md-preview td { padding: 6px 10px; border: 1px solid #E8E6E1; color: #3D3934; }
.md-preview ul, .md-preview ol { padding-left: 18px; margin: 6px 0; }
.md-preview li { margin-bottom: 4px; color: #3D3934; font-size: 14px; line-height: 1.7; }
.md-preview h1,.md-preview h2,.md-preview h3 { color: #3D3934; margin: 12px 0 6px; font-weight: 700; }
.md-preview blockquote { border-left: 3px solid #E8E6E1; padding-left: 10px; color: #787370; margin: 8px 0; }
.md-preview pre { background: #F0EEE9; border-radius: 8px; padding: 12px 14px; margin: 8px 0; overflow-x: auto; }
`;

const s: Record<string, React.CSSProperties> = {
  titleRow: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16},
  title: {margin: 0, fontSize: 22},
  addBtn: {padding: '8px 16px', background: '#3D3934', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer'},
  editor: {background: '#fff', border: '1px solid #E8E6E1', borderRadius: 10, padding: 16, marginBottom: 20},
  input: {width: '100%', padding: '10px 12px', border: '1px solid #E8E6E1', borderRadius: 8, fontSize: 15, marginBottom: 12, boxSizing: 'border-box'},
  editorBody: {display: 'flex', gap: 12},
  textarea: {flex: 1, minHeight: 260, padding: '10px 12px', border: '1px solid #E8E6E1', borderRadius: 8, fontSize: 14, fontFamily: 'monospace', lineHeight: 1.6, resize: 'vertical'},
  preview: {flex: 1, minHeight: 260, maxHeight: 400, overflowY: 'auto', padding: '10px 14px', border: '1px solid #E8E6E1', borderRadius: 8, background: '#FAFAF8'},
  editorFooter: {display: 'flex', alignItems: 'center', gap: 10, marginTop: 12},
  checkboxLabel: {display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#787370'},
  cancelBtn: {padding: '8px 16px', background: '#fff', border: '1px solid #E8E6E1', borderRadius: 8, fontSize: 14, cursor: 'pointer'},
  saveBtn: {padding: '8px 20px', background: '#7EB87E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 600},
  empty: {padding: 40, textAlign: 'center', color: '#A8A29E', background: '#fff', borderRadius: 10, border: '1px solid #E8E6E1'},
  list: {display: 'flex', flexDirection: 'column', gap: 8},
  listItem: {display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E8E6E1', borderRadius: 10, padding: '14px 16px'},
  itemTitle: {fontSize: 15, fontWeight: 600, color: '#3D3934', display: 'flex', alignItems: 'center', gap: 8},
  itemDate: {fontSize: 12, color: '#A8A29E', marginTop: 4},
  draftBadge: {fontSize: 11, color: '#E8917F', border: '1px solid #E8917F', borderRadius: 4, padding: '1px 6px'},
  editBtn: {padding: '6px 12px', background: '#fff', border: '1px solid #E8E6E1', borderRadius: 6, fontSize: 13, cursor: 'pointer'},
  delBtn: {padding: '6px 12px', background: '#fff', border: '1px solid #E8917F', color: '#E8917F', borderRadius: 6, fontSize: 13, cursor: 'pointer'},
};
