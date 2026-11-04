// dc-mini.js: maly renderer szablonow plansz (dziury {{ }}, sc-for, sc-if, zdarzenia, setState)
(function () {
  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const SINGLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function lookup(scope, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    let v = scope;
    for (const k of path.split('.')) {
      if (v == null) return undefined;
      v = v[k];
    }
    return v;
  }

  function interp(str, scope) {
    return str.replace(HOLE, (_, p) => {
      const v = lookup(scope, p);
      return v == null ? '' : String(v);
    });
  }

  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
    }
    setState(change) {
      const next = typeof change === 'function' ? change(this.state) : change;
      this.state = Object.assign({}, this.state, next);
      if (this.__render) this.__render();
    }
    forceUpdate() {
      if (this.__render) this.__render();
    }
  }

  function dispatch(e) {
    const h = e.currentTarget.__h && e.currentTarget.__h[e.type];
    if (h) h(e);
  }

  function build(node, scope, out) {
    if (node.nodeType === 3) {
      out.push(document.createTextNode(interp(node.nodeValue, scope)));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.localName;
    if (tag === 'helmet') return;
    if (tag === 'sc-for') {
      const m = (node.getAttribute('list') || '').match(SINGLE);
      const list = m ? lookup(scope, m[1]) : [];
      const as = node.getAttribute('as') || 'item';
      (list || []).forEach((item, i) => {
        const s = Object.create(scope);
        s[as] = item;
        s.$index = i;
        node.childNodes.forEach((c) => build(c, s, out));
      });
      return;
    }
    if (tag === 'sc-if') {
      const m = (node.getAttribute('value') || '').match(SINGLE);
      if (m && lookup(scope, m[1])) node.childNodes.forEach((c) => build(c, scope, out));
      return;
    }
    const el = node.namespaceURI === SVG_NS ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    for (const a of Array.from(node.attributes)) {
      if (a.name.startsWith('hint-')) continue;
      const single = a.value.match(SINGLE);
      if (a.name.startsWith('on') && single) {
        const fn = lookup(scope, single[1]);
        if (typeof fn === 'function') (el.__h || (el.__h = {}))[a.name.slice(2).toLowerCase()] = fn;
        continue;
      }
      el.setAttribute(a.name, interp(a.value, scope));
    }
    if (el.__h) for (const t in el.__h) el.addEventListener(t, dispatch);
    const kids = [];
    node.childNodes.forEach((c) => build(c, scope, kids));
    kids.forEach((k) => el.appendChild(k));
    out.push(el);
  }

  // aktualizuje istniejace wezly w miejscu, zeby przejscia CSS (wieko) dzialaly
  function patch(parent, fresh) {
    const old = Array.from(parent.childNodes);
    const n = Math.max(old.length, fresh.length);
    for (let i = 0; i < n; i++) {
      const o = old[i];
      const f = fresh[i];
      if (!f) { parent.removeChild(o); continue; }
      if (!o) { parent.appendChild(f); continue; }
      if (o.nodeType !== f.nodeType || o.nodeName !== f.nodeName) { parent.replaceChild(f, o); continue; }
      if (o.nodeType === 3) {
        if (o.nodeValue !== f.nodeValue) o.nodeValue = f.nodeValue;
        continue;
      }
      for (const a of Array.from(o.attributes)) if (!f.hasAttribute(a.name)) o.removeAttribute(a.name);
      for (const a of Array.from(f.attributes)) if (o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value);
      if (f.__h) {
        if (!o.__h) o.__h = {};
        for (const t in f.__h) {
          if (!o.__h[t]) o.addEventListener(t, dispatch);
          o.__h[t] = f.__h[t];
        }
      }
      patch(o, Array.from(f.childNodes));
    }
  }

  function mount(host, tplHTML, code, props) {
    const tpl = document.createElement('template');
    tpl.innerHTML = tplHTML;
    let Component;
    try {
      Component = new Function('DCLogic', code + '\n;return Component;')(DCLogic);
    } catch (err) {
      console.error('plansza: blad w kodzie', err);
      host.textContent = 'nie udało się wczytać planszy';
      return null;
    }
    const inst = new Component(props || {});
    const render = () => {
      const scope = inst.renderVals ? inst.renderVals() : {};
      const out = [];
      tpl.content.childNodes.forEach((c) => build(c, scope, out));
      patch(host, out);
    };
    inst.__render = render;
    render();
    if (inst.componentDidMount) inst.componentDidMount();
    return inst;
  }

  window.DCMini = { mount };
})();
