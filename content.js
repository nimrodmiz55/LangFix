// ── Keyboard map ───────────────────────────────────────────────────────────────
const EN_TO_HE = {
  q:'/', w:"'", e:'ק', r:'ר', t:'א', y:'ט', u:'ו', i:'ן', o:'ם', p:'פ',
  a:'ש', s:'ד', d:'ג', f:'כ', g:'ע', h:'י', j:'ח', k:'ל', l:'ך',
  ';':'ף', "'":",",
  z:'ז', x:'ס', c:'ב', v:'ה', b:'נ', n:'מ', m:'צ',
  ',':'ת', '.':'ץ', '/':'.'
};

const HE_TO_EN = Object.fromEntries(
  Object.entries(EN_TO_HE).map(([en, he]) => [he, en])
);

// ── Language detection ─────────────────────────────────────────────────────────
function detectDirection(text) {
  const he = (text.match(/[֐-׿]/g) || []).length;
  const en = (text.match(/[a-zA-Z]/g) || []).length;
  if (!he && !en) return null;
  return he >= en ? 'he-to-en' : 'en-to-he';
}

function convertText(text) {
  const dir = detectDirection(text);
  if (!dir) return text;
  const map = dir === 'en-to-he' ? EN_TO_HE : HE_TO_EN;
  return [...text].map(ch => map[ch.toLowerCase()] ?? ch).join('');
}

// ── Element helpers ────────────────────────────────────────────────────────────
function isEditable(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}

function getText(el) {
  // innerText respects line breaks; textContent is the fallback
  return el.isContentEditable ? (el.innerText || el.textContent || '') : el.value;
}

// Sets text in a way that makes React/ProseMirror/Lexical/Draft.js aware of
// the change, covering WhatsApp Web, ChatGPT, Facebook, and plain inputs.
function setText(el, text) {
  if (el.isContentEditable) {
    // 1. Force focus — without this, a floating-button click leaves the browser
    //    focus on the button and the subsequent selection targets a stale node.
    el.focus();
    // Dispatch a synthetic FocusEvent so React's event-delegation layer also
    // registers the element as active (programmatic focus() alone may not fire
    // the synthetic React onFocus that updates the editor's internal state).
    el.dispatchEvent(new FocusEvent('focus', { bubbles: false, cancelable: false }));

    // 2. Aggressively select all text using the Selection API.
    //    execCommand('selectAll') is intercepted and swallowed by WhatsApp Web
    //    before it reaches the browser, so we bypass it entirely.
    //    We walk to the deepest first/last text nodes so the range anchors
    //    correctly even inside WhatsApp's nested <p>/<span> structure.
    const sel   = window.getSelection();
    const range = document.createRange();

    const deepFirst = node => {
      while (node.firstChild) node = node.firstChild;
      return node;
    };
    const deepLast = node => {
      while (node.lastChild) node = node.lastChild;
      return node;
    };

    const first = deepFirst(el);
    const last  = deepLast(el);
    try {
      range.setStart(first, 0);
      range.setEnd(last, last.nodeType === Node.TEXT_NODE ? last.length : last.childNodes.length);
    } catch (_) {
      // If the deep-walk fails on an unusual DOM, fall back to container select
      range.selectNodeContents(el);
    }
    sel.removeAllRanges();
    sel.addRange(range);

    // 3. Replace the selection with the converted text.
    //    execCommand keeps React / Draft.js / Lexical in sync through their
    //    synthetic event delegation layers — direct innerText assignment would
    //    update the DOM but leave framework state stale.
    if (!document.execCommand('insertText', false, text)) {
      // Fallback: mutate the DOM and fire a synthetic InputEvent that React's
      // reconciler recognises as a controlled-input change.
      el.innerText = text;
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true,
        inputType: 'insertText', data: text,
      }));
    }
    return;
  }

  // <input> / <textarea>: React shadows the instance value setter, so we reach
  // the native prototype setter to bypass it, then fire the events React's
  // synthetic system subscribes to so it can sync its internal fiber state.
  const proto = window[el.tagName === 'TEXTAREA'
    ? 'HTMLTextAreaElement'
    : 'HTMLInputElement'].prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter ? setter.call(el, text) : (el.value = text);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── Core conversion ────────────────────────────────────────────────────────────
let activeEl = null;

function applyConversion() {
  const el = activeEl || document.activeElement;
  if (!isEditable(el)) return;
  const original = getText(el);
  const converted = convertText(original);
  if (converted !== original) setText(el, converted);
}

// ── Keyboard shortcut ──────────────────────────────────────────────────────────
// FIX 1 — OS layout agnostic: e.code is the PHYSICAL key ('KeyC') regardless
// of whether the OS keyboard is set to English or Hebrew. e.key would be 'c'
// in English layout but 'ב' in Hebrew layout — both are wrong to rely on.
//
// FIX 2 — Event burial: { capture: true } intercepts the event BEFORE any
// site script sees it. The three stop calls together prevent WhatsApp/ChatGPT
// from treating Alt+C as a submit or other action.
document.addEventListener('keydown', e => {
  if (e.altKey && e.code === 'KeyC') {
    e.preventDefault();               // block default browser action
    e.stopPropagation();              // stop bubbling phase
    e.stopImmediatePropagation();     // stop other capture-phase listeners
    applyConversion();
  }
}, { capture: true });

// ── Floating button ────────────────────────────────────────────────────────────
const btn = document.createElement('button');
btn.setAttribute('aria-label', 'LangFix – convert language');
btn.textContent = 'EN↔HE';
btn.style.cssText = [
  'all:unset',
  'position:fixed',
  'z-index:2147483647',
  'padding:2px 6px',
  'background:#1a73e8',
  'color:#fff',
  'border-radius:4px',
  'font:bold 11px/1.5 system-ui,sans-serif',
  'cursor:pointer',
  'box-shadow:0 1px 5px rgba(0,0,0,.4)',
  'display:none',
  'pointer-events:auto',
].join(';');

document.body.appendChild(btn);

function showButton(el) {
  const r = el.getBoundingClientRect();
  btn.style.top  = `${r.bottom + 5}px`;
  btn.style.left = `${r.right - 54}px`;
  btn.style.display = 'block';
}

function hideButton() {
  btn.style.display = 'none';
  activeEl = null;
}

// mousedown preventDefault keeps focus on the input — button click never steals it
btn.addEventListener('mousedown', e => e.preventDefault());
btn.addEventListener('click', applyConversion);

// ── Focus tracking ─────────────────────────────────────────────────────────────
document.addEventListener('focusin', e => {
  if (isEditable(e.target)) {
    activeEl = e.target;
    showButton(e.target);
  } else {
    hideButton();
  }
});

// Cover clicks on non-focusable areas (focusin never fires for them)
document.addEventListener('click', e => {
  if (e.target === btn) return;
  if (!isEditable(e.target)) {
    setTimeout(() => { if (!isEditable(document.activeElement)) hideButton(); }, 0);
  }
});

const reposition = () => { if (activeEl) showButton(activeEl); };
window.addEventListener('scroll', reposition, { capture: true, passive: true });
window.addEventListener('resize', reposition);

// ── Auto-focus bootstrap ───────────────────────────────────────────────────────
// Pages like Google auto-focus their search bar before the content script loads,
// so focusin is never fired. Poll once after a short delay to catch this case.
setTimeout(() => {
  const el = document.activeElement;
  if (isEditable(el)) {
    activeEl = el;
    showButton(el);
  }
}, 500);
