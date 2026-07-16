/**
 * Lightweight HTML sanitizer for dangerouslySetInnerHTML usage.
 * SSR-safe pure JavaScript implementation — no DOM dependency.
 *
 * Strategy: whitelist allowed tags and attributes; strip everything else.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup',
  'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'figure', 'figcaption',
  'blockquote', 'pre', 'code', 'span', 'div', 'hr',
  'dl', 'dt', 'dd', 'small', 'mark', 'abbr',
]);

const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'class', 'id',
  'colspan', 'rowspan', 'scope', 'align', 'valign',
  'width', 'height', 'loading', 'rel', 'target',
  'start', 'type', 'value', 'name',
  'aria-label', 'aria-hidden', 'aria-expanded', 'aria-controls',
  'role',
]);

const DANGEROUS_TAGS = /<\/?(?:script|iframe|object|embed|form|style|link|meta|base|applet|svg|math|input|textarea|select|button|noscript|template|slot)[\s>/]/gi;
const EVENT_HANDLER = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_PROTOCOL = /(?:href|src|action|formaction|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;

/**
 * Strip all HTML tags not in the whitelist.
 * Only keeps opening/closing tags that match ALLOWED_TAGS with permitted attributes.
 */
function stripDisallowedTags(html) {
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (match, tagName, attrs) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';

    // Sanitize attributes — keep only whitelisted ones, strip event handlers and js: protocols
    const safeAttrs = sanitizeAttributes(tag, attrs);
    if (match.startsWith('</')) {
      return `</${tag}>`;
    }
    // Self-closing or void elements
    if (match.endsWith('/>') || ['br', 'hr', 'img', 'input'].includes(tag)) {
      return `<${tag}${safeAttrs} />`;
    }
    return `<${tag}${safeAttrs}>`;
  });
}

/**
 * Filter attributes to only whitelisted ones; strip on* handlers and javascript: URIs.
 */
function sanitizeAttributes(tagName, attrsStr) {
  if (!attrsStr) return '';
  const result = [];
  const attrRegex = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match;

  while ((match = attrRegex.exec(attrsStr)) !== null) {
    const attrName = match[1].toLowerCase();
    const attrValue = match[2] ?? match[3] ?? match[4] ?? '';

    // Strip all on* event handlers
    if (attrName.startsWith('on')) continue;

    // Only allow whitelisted attributes
    if (!ALLOWED_ATTRS.has(attrName)) continue;

    // Strip javascript: protocol in URI attributes
    if (['href', 'src', 'action'].includes(attrName) && /^\s*javascript\s*:/i.test(attrValue)) {
      continue;
    }

    // For <a> tags, ensure href is safe
    if (attrName === 'href' && tagName === 'a') {
      if (/^\s*(javascript|data|vbscript)\s*:/i.test(attrValue)) continue;
    }

    // For <img> tags, validate src
    if (attrName === 'src' && tagName === 'img') {
      if (/^\s*(javascript|data|vbscript)\s*:/i.test(attrValue)) continue;
    }

    result.push(`${attrName}="${escapeAttrValue(attrValue)}"`);
  }

  return result.length > 0 ? ' ' + result.join(' ') : '';
}

/**
 * Escape characters in attribute values to prevent injection.
 */
function escapeAttrValue(val) {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sanitize HTML string for safe use with dangerouslySetInnerHTML.
 *
 * @param {string} html - Raw HTML string from CMS or user input.
 * @returns {string} Sanitized HTML safe for rendering.
 */
export function sanitizeHTML(html) {
  if (!html || typeof html !== 'string') return '';

  let safe = html;

  // 1. Remove dangerous tags entirely (script, iframe, object, embed, form, style, etc.)
  safe = safe.replace(DANGEROUS_TAGS, '');

  // 2. Remove event handler attributes (onclick, onerror, onload, etc.)
  safe = safe.replace(EVENT_HANDLER, '');

  // 3. Remove javascript: protocol in URI attributes
  safe = safe.replace(JS_PROTOCOL, '');

  // 4. Strip any remaining disallowed tags
  safe = stripDisallowedTags(safe);

  return safe;
}
