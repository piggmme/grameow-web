import { useEffect, useMemo, useState } from 'react';
import {
  api,
  type AdminChapter,
  type AdminCard,
  type AdminLessonDetail,
  type CardType,
  type LessonContent,
  type LessonExample,
} from './api';

// 콘텐츠에서 실제 쓰이는 마크다운 패턴만 처리하는 경량 파서
function renderMd(src: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inlineRender = (line: string): string =>
    escape(line)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

  const lines = src.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 빈 줄
    if (line.trim() === '') { i++; continue; }

    // 펜스드 코드블록 (``` ... ```)
    if (line.trimStart().startsWith('```')) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(escape(lines[i]));
        i++;
      }
      i++; // 닫는 ``` 건너뜀
      out.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // 헤딩
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      out.push(`<h${level}>${inlineRender(hMatch[2])}</h${level}>`);
      i++; continue;
    }

    // 표 (헤더 | ... 다음 줄이 |---|)
    if (line.includes('|') && lines[i + 1]?.match(/^\|[-| :]+\|$/)) {
      const headers = line.split('|').filter(c => c.trim()).map(c => `<th>${inlineRender(c.trim())}</th>`);
      out.push(`<table><thead><tr>${headers.join('')}</tr></thead><tbody>`);
      i += 2;
      while (i < lines.length && lines[i].includes('|')) {
        const cells = lines[i].split('|').filter(c => c.trim()).map(c => `<td>${inlineRender(c.trim())}</td>`);
        out.push(`<tr>${cells.join('')}</tr>`);
        i++;
      }
      out.push('</tbody></table>');
      continue;
    }

    // 리스트
    if (line.match(/^[-*]\s+/)) {
      out.push('<ul>');
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        out.push(`<li>${inlineRender(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push('</ul>');
      continue;
    }

    // blockquote
    if (line.startsWith('> ')) {
      out.push(`<blockquote>${inlineRender(line.slice(2))}</blockquote>`);
      i++; continue;
    }

    // 일반 단락
    out.push(`<p>${inlineRender(line)}</p>`);
    i++;
  }

  return out.join('');
}

function renderInlineMd(src: string): string {
  return src
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

const PREVIEW_CSS = `
.md-preview p { margin: 0 0 10px; color: #3D3934; font-size: 14px; line-height: 1.7; }
.md-preview strong { color: var(--accent, #6BA3D6); font-weight: 700; }
.md-preview code { background: #F0EEE9; color: #3D3934; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
.md-preview table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
.md-preview th { background: #F7F6F3; color: #787370; padding: 6px 10px; text-align: left; border: 1px solid #E8E6E1; font-weight: 600; }
.md-preview td { padding: 6px 10px; border: 1px solid #E8E6E1; color: #3D3934; }
.md-preview ul, .md-preview ol { padding-left: 18px; margin: 6px 0; }
.md-preview li { margin-bottom: 4px; color: #3D3934; font-size: 14px; line-height: 1.7; }
.md-preview h1,.md-preview h2,.md-preview h3 { color: #3D3934; margin: 12px 0 6px; font-weight: 700; }
.md-preview blockquote { border-left: 3px solid #E8E6E1; padding-left: 10px; color: #787370; margin: 8px 0; }
.md-preview pre { background: #F0EEE9; border-radius: 8px; padding: 12px 14px; margin: 8px 0; overflow-x: auto; }
.md-preview pre code { background: none; padding: 0; font-size: 12px; color: #3D3934; font-family: monospace; line-height: 1.6; white-space: pre; }
`;

// ─── helpers ───────────────────────────────────────────────────

function nextChapterSlug(chapters: AdminChapter[]): string {
  const nums = chapters
    .map(c => c.slug.match(/^ch(\d+)$/))
    .filter(Boolean)
    .map(m => parseInt(m![1], 10));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `ch${String(next).padStart(2, '0')}`;
}

function nextStageSlug(chapter: AdminChapter): string {
  const count = chapter.stages?.length ?? 0;
  return `${chapter.slug}-s${count + 1}`;
}

function nextLessonSlug(chapter: AdminChapter): string {
  const totalLessons = chapter.stages?.reduce((n, st) => n + (st.lessons?.length ?? 0), 0) ?? 0;
  return `${chapter.slug}-${String(totalLessons + 1).padStart(2, '0')}`;
}

function nextCardSlug(lessonSlug: string, cardCount: number): string {
  return `${lessonSlug}-c${String(cardCount + 1).padStart(2, '0')}`;
}

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
const LEVEL_KO: Record<string, string> = { BEGINNER: '초급', INTERMEDIATE: '중급', ADVANCED: '고급' };
const CARD_TYPES: CardType[] = ['FILL_BLANK', 'MULTIPLE_CHOICE', 'REORDER', 'TRANSLATE'];
const CARD_TYPE_KO: Record<CardType, string> = {
  FILL_BLANK: '빈칸',
  MULTIPLE_CHOICE: '객관식',
  REORDER: '순서배열',
  TRANSLATE: '번역',
};

// ─── ChapterPanel ───────────────────────────────────────────────

function ChapterPanel({
  chapters,
  selectedId,
  onSelect,
  onCreated,
  onDeleted,
}: {
  chapters: AdminChapter[];
  selectedId: number | null;
  onSelect: (ch: AdminChapter) => void;
  onCreated: (ch: AdminChapter) => void;
  onDeleted: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', level: 'BEGINNER', order: '', displayOrder: '' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.title || !form.order) return;
    setSaving(true);
    try {
      const autoSlug = nextChapterSlug(chapters);
      const order = Number(form.order);
      const ch = await api.createChapter({
        slug: autoSlug,
        title: form.title,
        description: form.description,
        level: form.level as any,
        order,
        displayOrder: Number(form.displayOrder) || order,
      });
      onCreated(ch);
      setAdding(false);
      setForm({ title: '', description: '', level: 'BEGINNER', order: '', displayOrder: '' });
    } catch (e: any) {
      alert(e?.message || '생성 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('챕터와 모든 하위 데이터가 삭제됩니다. 계속할까요?')) return;
    try {
      await api.deleteChapter(id);
      onDeleted(id);
    } catch (e: any) {
      alert(e?.message || '삭제 실패');
    }
  };

  return (
    <div style={s.panel}>
      <div style={s.panelHeader}>
        <span style={s.panelTitle}>챕터</span>
        <button style={s.addBtn} onClick={() => setAdding(v => !v)}>+ 추가</button>
      </div>

      {adding && (
        <div style={s.addForm}>
          <div style={s.autoSlug}>slug: {nextChapterSlug(chapters)} (자동)</div>
          <input style={s.input} placeholder="챕터명" value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <textarea style={{ ...s.input, height: 56 }} placeholder="설명" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <select style={s.input} value={form.level}
            onChange={e => setForm(p => ({ ...p, level: e.target.value }))}>
            {LEVELS.map(l => <option key={l} value={l}>{LEVEL_KO[l]}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={{ ...s.input, flex: 1 }} type="number" placeholder="순서" value={form.order}
              onChange={e => setForm(p => ({ ...p, order: e.target.value }))} />
            <input style={{ ...s.input, flex: 1 }} type="number" placeholder="표시순서" value={form.displayOrder}
              onChange={e => setForm(p => ({ ...p, displayOrder: e.target.value }))} />
          </div>
          <button style={{ ...s.saveBtn, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={handleCreate}>
            {saving ? '저장 중...' : '생성'}
          </button>
        </div>
      )}

      <div style={s.list}>
        {chapters.map(ch => (
          <div
            key={ch.id}
            style={{ ...s.listItem, ...(selectedId === ch.id ? s.listItemActive : {}) }}
            onClick={() => onSelect(ch)}
          >
            <div style={s.listItemMain}>
              <span style={{ ...s.levelDot, background: LEVEL_COLORS[ch.level] }} />
              <span style={s.listItemTitle}>{ch.title}</span>
            </div>
            <div style={s.listItemSub}>
              <span style={s.mono}>{ch.slug}</span>
              <button style={s.delBtn} onClick={e => { e.stopPropagation(); handleDelete(ch.id); }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── StagePanel ─────────────────────────────────────────────────

function StagePanel({
  chapter,
  selectedLessonId,
  onSelectLesson,
  onChapterUpdated,
}: {
  chapter: AdminChapter;
  selectedLessonId: number | null;
  onSelectLesson: (id: number) => void;
  onChapterUpdated: (ch: AdminChapter) => void;
}) {
  const [chapterState, setChapterState] = useState<AdminChapter>(chapter);
  const [addingStage, setAddingStage] = useState(false);
  const [stageForm, setStageForm] = useState({ title: '', order: '' });
  const [addingLesson, setAddingLesson] = useState<number | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: '', grammarPoint: '', order: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setChapterState(chapter);
  }, [chapter]);

  const reload = async () => {
    const updated = await api.listChapters();
    const found = updated.find(c => c.id === chapter.id);
    if (found) { setChapterState(found); onChapterUpdated(found); }
  };

  const createStage = async () => {
    if (!stageForm.title) return;
    setSaving(true);
    try {
      const autoSlug = nextStageSlug(chapterState);
      const order = Number(stageForm.order) || (chapterState.stages?.length ?? 0) + 1;
      await api.createStage({ slug: autoSlug, title: stageForm.title, order, chapterId: chapter.id });
      setAddingStage(false);
      setStageForm({ title: '', order: '' });
      await reload();
    } catch (e: any) { alert(e?.message || '생성 실패'); }
    finally { setSaving(false); }
  };

  const deleteStage = async (id: number) => {
    if (!confirm('스테이지와 모든 레슨이 삭제됩니다.')) return;
    try { await api.deleteStage(id); await reload(); }
    catch (e: any) { alert(e?.message || '삭제 실패'); }
  };

  const createLesson = async (stageId: number) => {
    if (!lessonForm.title || !lessonForm.grammarPoint) return;
    setSaving(true);
    try {
      const autoSlug = nextLessonSlug(chapterState);
      const stage = chapterState.stages?.find(s => s.id === stageId);
      const order = Number(lessonForm.order) || (stage?.lessons?.length ?? 0) + 1;
      await api.createLesson({
        slug: autoSlug, title: lessonForm.title,
        grammarPoint: lessonForm.grammarPoint,
        contents: [], examples: [], tips: null, imageUrl: null,
        order, stageId,
      });
      setAddingLesson(null);
      setLessonForm({ title: '', grammarPoint: '', order: '' });
      await reload();
    } catch (e: any) { alert(e?.message || '생성 실패'); }
    finally { setSaving(false); }
  };

  const deleteLesson = async (id: number) => {
    if (!confirm('레슨과 모든 카드가 삭제됩니다.')) return;
    try { await api.deleteLesson(id); await reload(); }
    catch (e: any) { alert(e?.message || '삭제 실패'); }
  };

  return (
    <div style={s.panel}>
      <div style={s.panelHeader}>
        <span style={s.panelTitle}>{chapter.title}</span>
        <button style={s.addBtn} onClick={() => setAddingStage(v => !v)}>+ 스테이지</button>
      </div>

      {addingStage && (
        <div style={s.addForm}>
          <div style={s.autoSlug}>slug: {nextStageSlug(chapterState)} (자동)</div>
          <input style={s.input} placeholder="스테이지명" value={stageForm.title}
            onChange={e => setStageForm(p => ({ ...p, title: e.target.value }))} />
          <input style={s.input} type="number" placeholder="순서 (비우면 자동)" value={stageForm.order}
            onChange={e => setStageForm(p => ({ ...p, order: e.target.value }))} />
          <button style={{ ...s.saveBtn, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={createStage}>
            {saving ? '...' : '생성'}
          </button>
        </div>
      )}

      <div style={s.list}>
        {chapterState.stages?.map(stage => (
          <div key={stage.id}>
            <div style={s.stageRow}>
              <span style={s.stageTitle}>📂 {stage.title}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={s.addBtn} onClick={() => { setAddingLesson(stage.id); setLessonForm({ title: '', grammarPoint: '', order: '' }); }}>
                  + 레슨
                </button>
                <button style={s.delBtn} onClick={() => deleteStage(stage.id)}>✕</button>
              </div>
            </div>

            {addingLesson === stage.id && (
              <div style={{ ...s.addForm, marginLeft: 12 }}>
                <div style={s.autoSlug}>slug: {nextLessonSlug(chapterState)} (자동)</div>
                <input style={s.input} placeholder="레슨 제목" value={lessonForm.title}
                  onChange={e => setLessonForm(p => ({ ...p, title: e.target.value }))} />
                <input style={s.input} placeholder="문법 포인트" value={lessonForm.grammarPoint}
                  onChange={e => setLessonForm(p => ({ ...p, grammarPoint: e.target.value }))} />
                <input style={s.input} type="number" placeholder="순서 (비우면 자동)" value={lessonForm.order}
                  onChange={e => setLessonForm(p => ({ ...p, order: e.target.value }))} />
                <button style={{ ...s.saveBtn, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={() => createLesson(stage.id)}>
                  {saving ? '...' : '생성'}
                </button>
              </div>
            )}

            {stage.lessons?.map(lesson => (
              <div
                key={lesson.id}
                style={{ ...s.lessonRow, ...(selectedLessonId === lesson.id ? s.listItemActive : {}) }}
                onClick={() => onSelectLesson(lesson.id)}
              >
                <div>
                  <span style={s.listItemTitle}>{lesson.title}</span>
                  <span style={{ ...s.mono, marginLeft: 6 }}>{lesson.slug}</span>
                </div>
                <button style={s.delBtn} onClick={e => { e.stopPropagation(); deleteLesson(lesson.id); }}>✕</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LessonEditor ───────────────────────────────────────────────

function LessonEditor({ lessonId, level, onUpdated }: { lessonId: number; level: string; onUpdated?: () => void }) {
  const [lesson, setLesson] = useState<AdminLessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'info' | 'content' | 'cards'>('info');

  useEffect(() => {
    setLoading(true);
    api.getLesson(lessonId).then(setLesson).catch(e => alert(e?.message)).finally(() => setLoading(false));
  }, [lessonId]);

  if (loading || !lesson) return <div style={{ padding: 24, color: '#888' }}>{loading ? '불러오는 중...' : '레슨 없음'}</div>;

  const save = async (patch: Parameters<typeof api.updateLesson>[1]) => {
    setSaving(true);
    try {
      const updated = await api.updateLesson(lessonId, patch);
      setLesson(prev => prev ? { ...prev, ...updated } : prev);
      onUpdated?.();
    } catch (e: any) { alert(e?.message || '저장 실패'); }
    finally { setSaving(false); }
  };

  return (
    <div style={s.editor}>
      <div style={s.editorHeader}>
        <span style={s.editorTitle}>{lesson.title}</span>
        <span style={s.mono}>{lesson.slug}</span>
      </div>

      <div style={s.tabs}>
        {(['info', 'content', 'cards'] as const).map(t => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {{ info: '기본 정보', content: '본문/예문', cards: `카드 (${lesson.cards.length})` }[t]}
          </button>
        ))}
      </div>

      {tab === 'info' && <InfoTab lesson={lesson} saving={saving} onSave={save} />}
      {tab === 'content' && <ContentTab lesson={lesson} saving={saving} onSave={save} level={level} />}
      {tab === 'cards' && <CardsTab lesson={lesson} onLessonUpdated={setLesson} />}
    </div>
  );
}

// ─── InfoTab ────────────────────────────────────────────────────

function InfoTab({
  lesson,
  saving,
  onSave,
}: {
  lesson: AdminLessonDetail;
  saving: boolean;
  onSave: (p: Parameters<typeof api.updateLesson>[1]) => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [grammarPoint, setGrammarPoint] = useState(lesson.grammarPoint);
  const [order, setOrder] = useState(String(lesson.order));

  useEffect(() => {
    setTitle(lesson.title);
    setGrammarPoint(lesson.grammarPoint);
    setOrder(String(lesson.order));
  }, [lesson]);

  return (
    <div style={s.tabContent}>
      <Field label="제목">
        <input style={s.input} value={title} onChange={e => setTitle(e.target.value)} />
      </Field>
      <Field label="문법 포인트">
        <input style={s.input} value={grammarPoint} onChange={e => setGrammarPoint(e.target.value)} />
      </Field>
      <Field label="순서">
        <input style={s.input} type="number" value={order} onChange={e => setOrder(e.target.value)} />
      </Field>
      <button
        style={{ ...s.saveBtn, opacity: saving ? 0.5 : 1 }}
        disabled={saving}
        onClick={() => onSave({ title, grammarPoint, order: Number(order) })}
      >
        {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  );
}

// ─── ContentTab ─────────────────────────────────────────────────

const ACCENT_COLORS: Record<string, string> = {
  BEGINNER: '#6BA3D6',
  INTERMEDIATE: '#7EB87E',
  ADVANCED: '#E8917F',
};

function ContentTab({
  lesson,
  saving,
  onSave,
  level,
}: {
  lesson: AdminLessonDetail;
  saving: boolean;
  onSave: (p: Parameters<typeof api.updateLesson>[1]) => void;
  level: string;
}) {
  const [contents, setContents] = useState<string[]>(
    lesson.contents.map(c => (typeof c === 'string' ? c : c.text))
  );
  const [examples, setExamples] = useState<LessonExample[]>(lesson.examples ?? []);
  const [tips, setTips] = useState<string[]>(lesson.tips ?? []);
  useEffect(() => {
    setContents(lesson.contents.map(c => (typeof c === 'string' ? c : c.text)));
    setExamples(lesson.examples ?? []);
    setTips(lesson.tips ?? []);
  }, [lesson]);

  const handleSave = () => {
    onSave({ contents, examples, tips: tips.length ? tips : null });
  };

  return (
    <div style={s.splitLayout}>
      {/* 왼쪽: 편집 */}
      <div style={s.splitEdit}>
        <SectionLabel>본문 블록</SectionLabel>
        {contents.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <textarea
              style={{ ...s.input, flex: 1, height: 80, fontFamily: 'monospace', fontSize: 12 }}
              value={c}
              onChange={e => setContents(prev => prev.map((x, j) => j === i ? e.target.value : x))}
            />
            <button style={s.delBtn} onClick={() => setContents(prev => prev.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button style={s.addBtn} onClick={() => setContents(prev => [...prev, ''])}>+ 블록 추가</button>

        <SectionLabel>예문</SectionLabel>
        {examples.map((ex, i) => (
          <div key={i} style={{ ...s.exRow, flexWrap: 'wrap' }}>
            <input style={{ ...s.input, flex: 1, minWidth: 120 }} placeholder="영어" value={ex.en}
              onChange={e => setExamples(prev => prev.map((x, j) => j === i ? { ...x, en: e.target.value } : x))} />
            <input style={{ ...s.input, flex: 1, minWidth: 120 }} placeholder="한국어" value={ex.ko}
              onChange={e => setExamples(prev => prev.map((x, j) => j === i ? { ...x, ko: e.target.value } : x))} />
            <input style={{ ...s.input, flex: 1, minWidth: 120 }} placeholder="설명 (선택)" value={ex.description ?? ''}
              onChange={e => setExamples(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
            <button style={s.delBtn} onClick={() => setExamples(prev => prev.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button style={s.addBtn} onClick={() => setExamples(prev => [...prev, { en: '', ko: '' }])}>+ 예문 추가</button>

        <SectionLabel>팁</SectionLabel>
        {tips.map((tip, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input style={{ ...s.input, flex: 1 }} value={tip}
              onChange={e => setTips(prev => prev.map((x, j) => j === i ? e.target.value : x))} />
            <button style={s.delBtn} onClick={() => setTips(prev => prev.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button style={s.addBtn} onClick={() => setTips(prev => [...prev, ''])}>+ 팁 추가</button>

        <div style={{ marginTop: 16 }}>
          <button style={{ ...s.saveBtn, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={handleSave}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 오른쪽: 미리보기 */}
      <div style={s.splitPreview}>
        <div style={s.splitPreviewLabel}>미리보기</div>
        <ContentPreview
          contents={contents}
          examples={examples}
          tips={tips}
          accentColor={ACCENT_COLORS[level] ?? ACCENT_COLORS.BEGINNER}
        />
      </div>
    </div>
  );
}

// ─── ContentPreview ──────────────────────────────────────────────

function ContentPreview({
  contents,
  examples,
  tips,
  accentColor,
}: {
  contents: string[];
  examples: LessonExample[];
  tips: string[];
  accentColor: string;
}) {
  const [activeCard, setActiveCard] = useState(0);

  const cards = useMemo(() => contents.map(text => ({ text })), [contents]);
  const totalCards = cards.length + (examples.length > 0 ? 1 : 0) + (tips.length > 0 ? 1 : 0);
  const examplesIdx = cards.length;
  const tipsIdx = cards.length + (examples.length > 0 ? 1 : 0);

  return (
    <div style={s.previewWrap}>
      {/* 폰 프레임 */}
      <div style={{ ...s.previewPhone, background: '#F7F6F3' }}>
        {/* 상단 컬러 바 */}
        <div style={{ height: 4, borderRadius: 4, background: accentColor, marginBottom: 12 }} />

        {/* 카드 */}
        <div style={{ ...s.previewCard, background: '#FFFFFF', minHeight: 340 }}>
          {activeCard < cards.length && (
            <MarkdownCard text={cards[activeCard].text} accentColor={accentColor} />
          )}
          {activeCard === examplesIdx && examples.length > 0 && (
            <ExamplesCard examples={examples} accentColor={accentColor} />
          )}
          {activeCard === tipsIdx && tips.length > 0 && (
            <TipsCard tips={tips} accentColor={accentColor} />
          )}
        </div>

        {/* 네비게이션 */}
        <div style={s.previewNav}>
          <button
            style={{ ...s.navBtn, borderColor: '#E8E6E1', color: '#3D3934', opacity: activeCard === 0 ? 0.3 : 1 }}
            disabled={activeCard === 0}
            onClick={() => setActiveCard(p => p - 1)}
          >←</button>
          <span style={{ ...s.navCount, color: '#787370' }}>{activeCard + 1} / {totalCards}</span>
          <button
            style={{ ...s.navBtn, borderColor: '#E8E6E1', color: '#3D3934', opacity: activeCard === totalCards - 1 ? 0.3 : 1 }}
            disabled={activeCard === totalCards - 1}
            onClick={() => setActiveCard(p => p + 1)}
          >→</button>
        </div>

        {/* 인디케이터 */}
        <div style={s.previewDots}>
          {Array.from({ length: totalCards }).map((_, i) => (
            <div
              key={i}
              style={{ ...s.dot, background: i === activeCard ? accentColor : '#D5D2CD', ...(i === activeCard ? s.dotActive : {}) }}
              onClick={() => setActiveCard(i)}
            />
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div style={s.previewLegend}>
        {cards.map((_, i) => (
          <div key={i} style={s.legendItem} onClick={() => setActiveCard(i)}>
            <span style={{ ...s.legendDot, background: i === activeCard ? accentColor : '#D5D2CD' }} />
            <span style={{ fontSize: 11, color: i === activeCard ? '#3D3934' : '#787370' }}>본문 {i + 1}</span>
          </div>
        ))}
        {examples.length > 0 && (
          <div style={s.legendItem} onClick={() => setActiveCard(examplesIdx)}>
            <span style={{ ...s.legendDot, background: activeCard === examplesIdx ? accentColor : '#D5D2CD' }} />
            <span style={{ fontSize: 11, color: activeCard === examplesIdx ? '#3D3934' : '#787370' }}>예문 ({examples.length}개)</span>
          </div>
        )}
        {tips.length > 0 && (
          <div style={s.legendItem} onClick={() => setActiveCard(tipsIdx)}>
            <span style={{ ...s.legendDot, background: activeCard === tipsIdx ? accentColor : '#D5D2CD' }} />
            <span style={{ fontSize: 11, color: activeCard === tipsIdx ? '#3D3934' : '#787370' }}>팁 ({tips.length}개)</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MarkdownCard({ text, accentColor }: { text: string; accentColor: string }) {
  const html = useMemo(() => renderMd(text), [text]);
  return (
    <div
      className="md-preview"
      style={{ ...s.mdCard, '--accent': accentColor } as React.CSSProperties}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ExamplesCard({ examples, accentColor }: { examples: LessonExample[]; accentColor: string }) {
  return (
    <div style={s.examplesCard}>
      <div style={{ ...s.examplesLabel, color: accentColor }}>예문</div>
      {examples.map((ex, i) => (
        <div key={i} style={s.exampleItem}>
          <div style={s.exEn} dangerouslySetInnerHTML={{ __html: renderInlineMd(ex.en) }} />
          <div style={s.exKo}>{ex.ko}</div>
          {ex.description && <div style={s.exDesc}>{ex.description}</div>}
        </div>
      ))}
    </div>
  );
}

function TipsCard({ tips, accentColor }: { tips: string[]; accentColor: string }) {
  return (
    <div style={s.tipsCard}>
      <div style={{ ...s.tipsLabel, color: accentColor }}>핵심 정리 💡</div>
      {tips.map((tip, i) => (
        <div key={i} style={s.tipItem}>
          <span style={{ ...s.tipBullet, color: accentColor }}>•</span>
          <span dangerouslySetInnerHTML={{ __html: renderInlineMd(tip) }} />
        </div>
      ))}
    </div>
  );
}

// ─── CardsTab ───────────────────────────────────────────────────

function CardsTab({
  lesson,
  onLessonUpdated,
}: {
  lesson: AdminLessonDetail;
  onLessonUpdated: (l: AdminLessonDetail) => void;
}) {
  const [cards, setCards] = useState<AdminCard[]>(lesson.cards);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [newCard, setNewCard] = useState<Partial<AdminCard>>({ type: 'FILL_BLANK', order: (lesson.cards.length + 1) });

  useEffect(() => { setCards(lesson.cards); }, [lesson]);

  const reload = async () => {
    const updated = await api.getLesson(lesson.id);
    setCards(updated.cards);
    onLessonUpdated(updated);
  };

  const saveCard = async (card: AdminCard) => {
    try {
      await api.updateCard(card.id, {
        type: card.type, question: card.question, answer: card.answer,
        alternativeAnswers: card.alternativeAnswers,
        hint: card.hint, options: card.options,
        description: card.description, explanation: card.explanation, order: card.order,
      });
      setEditingId(null);
      await reload();
    } catch (e: any) { alert(e?.message || '저장 실패'); }
  };

  const createCard = async () => {
    if (!newCard.type || !newCard.question || !newCard.answer) return;
    try {
      await api.createCard({
        slug: nextCardSlug(lesson.slug, cards.length),
        type: newCard.type as CardType,
        question: newCard.question!,
        answer: newCard.answer!,
        alternativeAnswers: newCard.alternativeAnswers ?? null,
        hint: newCard.hint ?? null,
        options: newCard.options ?? null,
        description: newCard.description ?? null,
        explanation: newCard.explanation ?? null,
        order: newCard.order ?? cards.length + 1,
        lessonId: lesson.id,
      });
      setEditingId(null);
      setNewCard({ type: 'FILL_BLANK', order: cards.length + 2 });
      await reload();
    } catch (e: any) { alert(e?.message || '생성 실패'); }
  };

  const deleteCard = async (id: number) => {
    if (!confirm('카드를 삭제할까요?')) return;
    try { await api.deleteCard(id); await reload(); }
    catch (e: any) { alert(e?.message || '삭제 실패'); }
  };

  return (
    <div style={s.tabContent}>
      {cards.map(card => (
        <div key={card.id} style={s.cardRow}>
          {editingId === card.id
            ? <CardForm card={card} onSave={saveCard} onCancel={() => setEditingId(null)} />
            : (
              <div style={s.cardPreview}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={s.cardTypeBadge}>{CARD_TYPE_KO[card.type]}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{card.question}</span>
                  <span style={{ fontSize: 12, color: '#888' }}>→ {card.answer}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button style={s.addBtn} onClick={() => setEditingId(card.id)}>편집</button>
                  <button style={s.delBtn} onClick={() => deleteCard(card.id)}>✕</button>
                </div>
              </div>
            )
          }
        </div>
      ))}

      {editingId === 'new'
        ? <CardForm card={newCard as AdminCard} onSave={createCard as any} onCancel={() => setEditingId(null)} isNew />
        : (
          <button
            style={{ ...s.saveBtn, marginTop: 12, background: '#7EB87E' }}
            onClick={() => { setEditingId('new'); setNewCard({ type: 'FILL_BLANK', order: cards.length + 1 }); }}
          >
            + 카드 추가
          </button>
        )
      }
    </div>
  );
}

// ─── CardForm ───────────────────────────────────────────────────

function CardForm({
  card,
  onSave,
  onCancel,
  isNew = false,
}: {
  card: AdminCard;
  onSave: (c: AdminCard) => void;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const [form, setForm] = useState<AdminCard>({ ...card });

  const set = (key: keyof AdminCard, value: any) => setForm(p => ({ ...p, [key]: value }));

  const needsOptions = form.type === 'MULTIPLE_CHOICE';
  const needsHint = form.type === 'FILL_BLANK' || form.type === 'REORDER';

  return (
    <div style={s.cardFormBox}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <select style={{ ...s.input, width: 120 }} value={form.type}
          onChange={e => set('type', e.target.value as CardType)}>
          {CARD_TYPES.map(t => <option key={t} value={t}>{CARD_TYPE_KO[t]}</option>)}
        </select>
        <input style={{ ...s.input, width: 60 }} type="number" placeholder="순서" value={form.order}
          onChange={e => set('order', Number(e.target.value))} />
      </div>

      <Field label="질문 ({{blank}}으로 빈칸)">
        <textarea style={{ ...s.input, height: 64 }} value={form.question}
          onChange={e => set('question', e.target.value)} />
      </Field>
      <Field label="정답">
        <input style={s.input} value={form.answer} onChange={e => set('answer', e.target.value)} />
      </Field>
      <Field label="대체 정답 (쉼표 구분)">
        <input style={s.input}
          value={(form.alternativeAnswers ?? []).join(', ')}
          onChange={e => set('alternativeAnswers', e.target.value ? e.target.value.split(',').map(v => v.trim()) : null)}
        />
      </Field>

      {needsOptions && (
        <Field label="선택지 (쉼표 구분)">
          <input style={s.input}
            value={(form.options ?? []).join(', ')}
            onChange={e => set('options', e.target.value ? e.target.value.split(',').map(v => v.trim()) : null)}
          />
        </Field>
      )}
      {needsHint && (
        <Field label="힌트">
          <input style={s.input} value={form.hint ?? ''} onChange={e => set('hint', e.target.value || null)} />
        </Field>
      )}

      <Field label="한국어 설명">
        <input style={s.input} value={form.description ?? ''} onChange={e => set('description', e.target.value || null)} />
      </Field>
      <Field label="해설">
        <textarea style={{ ...s.input, height: 56 }} value={form.explanation ?? ''}
          onChange={e => set('explanation', e.target.value || null)} />
      </Field>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button style={s.saveBtn} onClick={() => onSave(form)}>{isNew ? '생성' : '저장'}</button>
        <button style={{ ...s.saveBtn, background: '#aaa' }} onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}

// ─── small helpers ───────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: '#3D3934', margin: '16px 0 8px' }}>{children}</div>;
}

// ─── Root ───────────────────────────────────────────────────────

export default function CurriculumEditor() {
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<AdminChapter | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);

  useEffect(() => {
    api.listChapters()
      .then(data => { setChapters(data); })
      .catch(e => alert(e?.message || '불러오기 실패'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 32 }}>불러오는 중...</div>;

  return (
    <div style={s.root}>
      <style>{PREVIEW_CSS}</style>
      <ChapterPanel
        chapters={chapters}
        selectedId={selectedChapter?.id ?? null}
        onSelect={ch => { setSelectedChapter(ch); setSelectedLessonId(null); }}
        onCreated={ch => setChapters(prev => [...prev, ch])}
        onDeleted={id => {
          setChapters(prev => prev.filter(c => c.id !== id));
          if (selectedChapter?.id === id) { setSelectedChapter(null); setSelectedLessonId(null); }
        }}
      />

      {selectedChapter && (
        <StagePanel
          chapter={selectedChapter}
          selectedLessonId={selectedLessonId}
          onSelectLesson={setSelectedLessonId}
          onChapterUpdated={ch => {
            setSelectedChapter(ch);
            setChapters(prev => prev.map(c => c.id === ch.id ? ch : c));
          }}
        />
      )}

      {selectedLessonId && (
        <LessonEditor
          key={selectedLessonId}
          lessonId={selectedLessonId}
          level={selectedChapter?.level ?? 'BEGINNER'}
        />
      )}
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  BEGINNER: '#7EB87E',
  INTERMEDIATE: '#6BA3D6',
  ADVANCED: '#E8917F',
};

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', gap: 0, height: 'calc(100vh - 60px)', overflow: 'hidden', margin: -24 },

  panel: {
    width: 280,
    minWidth: 280,
    borderRight: '1px solid #E8E6E1',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid #E8E6E1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#F7F6F3',
  },
  panelTitle: { fontSize: 14, fontWeight: 700, color: '#3D3934' },
  list: { flex: 1, overflowY: 'auto' },
  listItem: {
    padding: '10px 14px',
    borderBottom: '1px solid #F0EEE9',
    cursor: 'pointer',
  },
  listItemActive: { background: '#EFF6EF' },
  listItemMain: { display: 'flex', alignItems: 'center', gap: 6 },
  listItemTitle: { fontSize: 13, fontWeight: 500, color: '#3D3934' },
  listItemSub: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  levelDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },

  stageRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    background: '#F7F6F3',
    borderBottom: '1px solid #F0EEE9',
  },
  stageTitle: { fontSize: 13, fontWeight: 600, color: '#3D3934' },
  lessonRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px 8px 24px',
    borderBottom: '1px solid #F5F3F0',
    cursor: 'pointer',
  },

  editor: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  editorHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #E8E6E1',
    background: '#F7F6F3',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  editorTitle: { fontSize: 15, fontWeight: 700, color: '#3D3934' },

  tabs: { display: 'flex', borderBottom: '1px solid #E8E6E1', background: '#FAFAF8' },
  tab: {
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: '#787370',
    borderBottom: '2px solid transparent',
  },
  tabActive: { color: '#3D3934', borderBottom: '2px solid #3D3934', fontWeight: 600 },
  tabContent: { flex: 1, overflowY: 'auto', padding: '16px' },

  addForm: {
    padding: '10px 14px',
    borderBottom: '1px solid #E8E6E1',
    background: '#FFFEF9',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  exRow: { display: 'flex', gap: 6, marginBottom: 6 },

  cardRow: { marginBottom: 10 },
  cardPreview: {
    border: '1px solid #E8E6E1',
    borderRadius: 8,
    padding: '10px 12px',
    background: '#FAFAF8',
  },
  cardTypeBadge: {
    fontSize: 11,
    padding: '2px 7px',
    borderRadius: 10,
    background: '#E8E6E1',
    color: '#555',
    fontWeight: 600,
  },
  cardFormBox: {
    border: '1px solid #D0E8D0',
    borderRadius: 8,
    padding: '12px',
    background: '#F7FBF7',
  },

  input: {
    width: '100%',
    padding: '6px 10px',
    border: '1px solid #E8E6E1',
    borderRadius: 6,
    fontSize: 13,
    background: '#fff',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  addBtn: {
    padding: '4px 10px',
    background: '#3D3934',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  saveBtn: {
    padding: '6px 14px',
    background: '#3D3934',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
  },
  delBtn: {
    padding: '2px 7px',
    background: 'none',
    border: '1px solid #E8E6E1',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    color: '#E8917F',
  },
  mono: { fontFamily: 'monospace', fontSize: 11, color: '#999' },
  autoSlug: { fontFamily: 'monospace', fontSize: 11, color: '#7EB87E', marginBottom: 2 },

  // 좌우 분할 레이아웃
  splitLayout: { display: 'flex', gap: 0, height: '100%', overflow: 'hidden' },
  splitEdit: { flex: 1, overflowY: 'auto', padding: 16, borderRight: '1px solid #E8E6E1', minWidth: 0 },
  splitPreview: { width: 520, flexShrink: 0, overflowY: 'auto', padding: 16, background: '#FAFAF8' },
  splitPreviewLabel: { fontSize: 11, fontWeight: 600, color: '#B0ADA8', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12 },

  // 미리보기
  previewWrap: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  previewPhone: {
    width: 320, flexShrink: 0,
    background: '#F7F6F3', borderRadius: 24,
    padding: '16px 12px 12px',
    border: '1px solid #E8E6E1',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  },
  previewCard: {
    minHeight: 340, background: '#FFFFFF', borderRadius: 16,
    padding: 20, marginBottom: 12, overflow: 'auto',
    border: '1px solid #E8E6E1',
  },
  previewNav: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 },
  navBtn: {
    background: '#fff', border: '1px solid #E8E6E1', color: '#3D3934',
    borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 16,
  },
  navCount: { color: '#787370', fontSize: 12 },
  previewDots: { display: 'flex', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: '50%', background: '#D5D2CD', cursor: 'pointer', transition: 'width 0.2s' },
  dotActive: { width: 18, borderRadius: 3 },

  // 범례
  previewLegend: { display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' },
  legendDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },

  // 마크다운 카드
  mdCard: { color: '#3D3934', fontSize: 14, lineHeight: 1.7 },

  // 예문 카드
  examplesCard: { color: '#3D3934' },
  examplesLabel: { fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 1 },
  exampleItem: { marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #F0EEE9' },
  exEn: { fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#3D3934' },
  exKo: { fontSize: 13, color: '#787370', marginBottom: 2 },
  exDesc: { fontSize: 11, color: '#B0ADA8', marginTop: 2 },

  // 팁 카드
  tipsCard: { color: '#3D3934' },
  tipsLabel: { fontSize: 13, fontWeight: 700, marginBottom: 12 },
  tipItem: { display: 'flex', gap: 8, marginBottom: 8, fontSize: 13, lineHeight: 1.6, color: '#3D3934' },
  tipBullet: { flexShrink: 0, marginTop: 1, fontWeight: 700 },
};
