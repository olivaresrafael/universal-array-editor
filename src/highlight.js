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

export function highlight(text, format) {
  return format === 'yaml' ? highlightYaml(text) : highlightJson(text);
}
