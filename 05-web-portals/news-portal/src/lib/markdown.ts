import MarkdownIt from 'markdown-it';

// html:false => raw HTML in source markdown is escaped, so scraped/official text can never inject markup.
const md = new MarkdownIt({ html: false, linkify: true, breaks: false, typographer: false });

const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const t = tokens[idx];
  const href = t.attrGet('href') || '';
  if (!/^(https?:|mailto:|\/|#)/i.test(href)) {
    t.attrSet('href', '#');
  } else if (/^https?:/i.test(href)) {
    t.attrSet('rel', 'noopener noreferrer nofollow');
    t.attrSet('target', '_blank');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export function renderMarkdown(src: string): string {
  return md.render(src || '');
}

export function plainExcerpt(src: string, max = 160): string {
  const t = (src || '')
    .replace(/[#>*_`\[\]()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}
