// 경량 마크다운 → HTML 렌더러. 외부 의존성 없음.
// 어드민 공지 미리보기와 공개 공지 페이지에서 공유.
// (원래 CurriculumEditor.tsx에 있던 renderMd를 추출)

export function renderMd(src: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inlineRender = (line: string): string =>
    escape(line)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

  const lines = src.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    // 펜스드 코드블록
    if (line.trimStart().startsWith('```')) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(escape(lines[i]));
        i++;
      }
      i++;
      out.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // 헤딩
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      out.push(`<h${level}>${inlineRender(hMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // 표
    if (line.includes('|') && lines[i + 1]?.match(/^\|[-| :]+\|$/)) {
      const headers = line
        .split('|')
        .filter((c) => c.trim())
        .map((c) => `<th>${inlineRender(c.trim())}</th>`);
      out.push(`<table><thead><tr>${headers.join('')}</tr></thead><tbody>`);
      i += 2;
      while (i < lines.length && lines[i].includes('|')) {
        const cells = lines[i]
          .split('|')
          .filter((c) => c.trim())
          .map((c) => `<td>${inlineRender(c.trim())}</td>`);
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
      i++;
      continue;
    }

    out.push(`<p>${inlineRender(line)}</p>`);
    i++;
  }

  return out.join('');
}
