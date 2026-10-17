// Pure string highlighters (no DOM) so they can be unit-tested in Node.
// Input is trusted only after escaping: every character is HTML-escaped
// before any <span> is added, so user data can never inject markup.

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapPunctuation(escapedText) {
  return escapedText.replace(/([{[\]}:,])/g, '<span class="tok-punct">$1</span>');
}

export function highlightJson(text) {
  // Also covers JSON5: single-quoted strings, bare keys, Infinity/NaN, hex.
  const token = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"|'(?:\\.|[^'\\])*')(\s*:)?|([A-Za-z_$][\w$]*)(\s*:)|\b(true|false)\b|\bnull\b|\b(Infinity|NaN)\b|-?0[xX][0-9a-fA-F]+|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let html = '';
  let last = 0;
  let match;
  while ((match = token.exec(text)) !== null) {
    html += wrapPunctuation(escapeHtml(text.slice(last, match.index)));
    const [full, quoted, quotedColon, bareKey, , bool] = match;
    if (quoted !== undefined) {
      const cls = quotedColon !== undefined ? 'tok-key' : 'tok-string';
      html += `<span class="${cls}">${escapeHtml(full)}</span>`;
    } else if (bareKey !== undefined) {
      html += `<span class="tok-key">${escapeHtml(full)}</span>`;
    } else if (bool !== undefined) {
      html += `<span class="tok-bool">${escapeHtml(full)}</span>`;
    } else if (full === 'null') {
      html += `<span class="tok-null">${escapeHtml(full)}</span>`;
    } else {
      html += `<span class="tok-number">${escapeHtml(full)}</span>`;
    }
    last = match.index + full.length;
  }
  html += wrapPunctuation(escapeHtml(text.slice(last)));
  return html;
}

const YAML_INLINE = /('(?:[^']|'')*'|"(?:\\.|[^"\\])*")|\b(true|false|yes|no|on|off)\b|\bnull\b|\b-?(?:\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)\b/gi;

function highlightYamlInline(raw) {
  let html = '';
  let last = 0;
  let match;
  YAML_INLINE.lastIndex = 0;
  while ((match = YAML_INLINE.exec(raw)) !== null) {
    html += escapeHtml(raw.slice(last, match.index));
    const [full, quoted, boolWord] = match;
    if (quoted !== undefined) html += `<span class="tok-string">${escapeHtml(full)}</span>`;
    else if (boolWord !== undefined) html += `<span class="tok-bool">${boolWord}</span>`;
    else if (/^null$/i.test(full)) html += `<span class="tok-null">${full}</span>`;
    else html += `<span class="tok-number">${full}</span>`;
    last = match.index + full.length;
  }
  html += escapeHtml(raw.slice(last));
  return html;
}

function highlightYamlCode(code) {
  let prefix = '';
  let rest = code;
  const dash = code.match(/^(\s*)-(?=\s|$)/);
  if (dash) {
    prefix += `${escapeHtml(dash[1])}<span class="tok-punct">-</span>`;
    rest = code.slice(dash[0].length);
  }
  const key = rest.match(/^(\s*)([^\s:#\-?[\]{},][^:#]*?)(:)(\s|$)/);
  if (key) {
    prefix += `${escapeHtml(key[1])}<span class="tok-key">${escapeHtml(key[2])}</span><span class="tok-punct">:</span>${escapeHtml(key[4])}`;
    rest = rest.slice(key[0].length);
  }
  const inline = highlightYamlInline(rest);
  if (!inline.includes('<span') && /^\s*[^#\s"'[{>&*!|][^#]*?\s*$/.test(rest) && rest.trim() !== '') {
    // Plain scalar value (e.g. `name: First item`) shown as text.
    const padded = rest.match(/^(\s*)(.*?)(\s*)$/s);
    return prefix + escapeHtml(padded[1]) + `<span class="tok-string">${escapeHtml(padded[2])}</span>` + escapeHtml(padded[3]);
  }
  return prefix + inline;
}

export function highlightYaml(text) {
  return String(text)
    .split('\n')
    .map((line) => {
      let code = line;
      let comment = '';
      const commentStart = line.search(/(^|\s)#/);
      if (commentStart !== -1) {
        const hashIndex = line.indexOf('#', commentStart);
        code = line.slice(0, hashIndex);
        comment = line.slice(hashIndex);
      }
      let html = highlightYamlCode(code);
      if (comment) html += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
      return html;
    })
    .join('\n');
}

export function highlight(text, format, csvDelimiter = ',') {
  if (format === 'yaml') return highlightYaml(text);
  if (format === 'csv') return highlightDelimited(text, csvDelimiter || ',');
  if (format === 'tsv') return highlightDelimited(text, '\t');
  return highlightJson(text);
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '""';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function highlightDelimitedCell(cell) {
  const trimmed = cell.trim();
  if (/^".*"$/s.test(trimmed) && trimmed.length >= 2) return `<span class="tok-string">${escapeHtml(cell)}</span>`;
  if (/^(true|false)$/i.test(trimmed)) return `<span class="tok-bool">${escapeHtml(cell)}</span>`;
  if (/^null$/i.test(trimmed)) return `<span class="tok-null">${escapeHtml(cell)}</span>`;
  if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(trimmed) && Number.isFinite(Number(trimmed))) {
    return `<span class="tok-number">${escapeHtml(cell)}</span>`;
  }
  return escapeHtml(cell);
}

export function highlightDelimited(text, delimiter) {
  // Split lines honoring quoted sections (exported cells may contain newlines).
  const lines = [];
  let current = '';
  let inQuotes = false;
  const normalized = String(text).replace(/\r\n?/g, '\n');
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === '"') {
      if (inQuotes && normalized[i + 1] === '"') {
        current += '""';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  lines.push(current);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const punct = delimiter === '\t' ? '→' : delimiter;
  return lines
    .map((line, index) => {
      const cells = splitDelimitedLine(line, delimiter);
      const painted = cells.map((cell) => (index === 0 ? `<span class="tok-key">${escapeHtml(cell)}</span>` : highlightDelimitedCell(cell)));
      return painted.join(`<span class="tok-punct">${escapeHtml(punct)}</span>`);
    })
    .join('\n');
}
