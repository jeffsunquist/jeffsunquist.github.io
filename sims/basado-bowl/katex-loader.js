// Load self-hosted KaTeX for the game.
//
// Published builds serve it at /katex/. When running from the source tree,
// fall back to node_modules/katex/dist. If neither is available, game.js keeps
// the original subscript/superscript renderer.
const BASES = [
  new URL('../../katex/', import.meta.url),
  new URL('../../node_modules/katex/dist/', import.meta.url),
];

let loading = null;

function probe(url) {
  return fetch(url, { method: 'HEAD', cache: 'no-store' })
    .then((res) => res.ok)
    .catch(() => false);
}

function loadStylesheet(href) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.katex = 'true';
    link.onload = () => resolve(true);
    link.onerror = () => resolve(false);
    document.head.appendChild(link);
  });
}

function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export function loadKatex() {
  if (window.katex) return Promise.resolve(true);
  if (loading) return loading;

  loading = (async () => {
    for (const base of BASES) {
      const scriptUrl = new URL('katex.min.js', base).href;
      if (!(await probe(scriptUrl))) continue;
      await loadStylesheet(new URL('katex.min.css', base).href);
      await loadScript(scriptUrl);
      if (window.katex) return true;
    }
    return false;
  })();

  return loading;
}
