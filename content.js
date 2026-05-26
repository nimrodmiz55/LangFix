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
    // 1. Select all existing content inside the editable node
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);

    // 2. execCommand fires a real InputEvent that ProseMirror/Lexical listen to.
    //    A plain el.innerText assignment bypasses those frameworks entirely.
    if (!document.execCommand('insertText', false, text)) {
      // Fallback: direct mutation + manual InputEvent for edge cases
      el.innerText = text;
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true,
        inputType: 'insertText', data: text
      }));
    }
    return;
  }

  // For React controlled <input>/<textarea>: React overrides the value setter,
  // so we reach past it via the prototype, then fire input/change so React's
  // synthetic event system syncs its internal fiber state.
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
