// Standard Israeli QWERTY layout: English key → Hebrew character produced
const EN_TO_HE = {
  q:'/', w:"'", e:'ק', r:'ר', t:'א', y:'ט', u:'ו', i:'ן', o:'ם', p:'פ',
  a:'ש', s:'ד', d:'ג', f:'כ', g:'ע', h:'י', j:'ח', k:'ל', l:'ך',
  ';':'ף', "'":",",
  z:'ז', x:'ס', c:'ב', v:'ה', b:'נ', n:'מ', m:'צ',
  ',':'ת', '.':'ץ', '/':'.'
};

// Build reverse map: Hebrew character → English key
const HE_TO_EN = Object.fromEntries(
  Object.entries(EN_TO_HE).map(([en, he]) => [he, en])
);

// Count Hebrew vs Latin chars to decide conversion direction.
// Returns 'en-to-he', 'he-to-en', or null if nothing to convert.
function detectDirection(text) {
  const heCount = (text.match(/[֐-׿]/g) || []).length;
  const enCount = (text.match(/[a-zA-Z]/g) || []).length;
  if (heCount === 0 && enCount === 0) return null;
  return heCount >= enCount ? 'he-to-en' : 'en-to-he';
}

function convertText(text) {
  const dir = detectDirection(text);
  if (!dir) return text;
  const map = dir === 'en-to-he' ? EN_TO_HE : HE_TO_EN;
  // Lowercase before lookup so uppercase Latin letters also match
  return [...text].map(ch => map[ch.toLowerCase()] ?? ch).join('');
}

function isEditable(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

function getValue(el) {
  return el.isContentEditable ? el.innerText : el.value;
}

// Use the native property setter so frameworks (React, Vue) detect the change
function setValue(el, text) {
  if (el.isContentEditable) {
    el.innerText = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const proto = window[el.tagName === 'TEXTAREA'
    ? 'HTMLTextAreaElement'
    : 'HTMLInputElement'].prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter ? setter.call(el, text) : (el.value = text);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── Floating button ──────────────────────────────────────────────────────────

const btn = document.createElement('button');
btn.setAttribute('aria-label', 'LangFix: convert language');
btn.textContent = 'EN↔HE';
btn.style.cssText = [
  'all:unset',                          // reset page styles
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
  'opacity:.9',
  'transition:opacity .15s',
  'pointer-events:auto',
].join(';');

document.body.appendChild(btn);

let activeEl = null;

function showButton(el) {
  const r = el.getBoundingClientRect();
  // Place button inside the top-right corner of the input
  btn.style.top  = `${r.top  + 4}px`;
  btn.style.left = `${r.right - 54}px`;  // ~54 px matches button width
  btn.style.display = 'block';
}

function hideButton() {
  btn.style.display = 'none';
  activeEl = null;
}

function applyConversion() {
  const el = activeEl || document.activeElement;
  if (!isEditable(el)) return;
  const original = getValue(el);
  const converted = convertText(original);
  if (converted !== original) setValue(el, converted);
}

// Prevent the button click from stealing focus away from the active input
btn.addEventListener('mousedown', e => e.preventDefault());
btn.addEventListener('click', applyConversion);

// ── Focus tracking ────────────────────────────────────────────────────────────

document.addEventListener('focusin', e => {
  if (isEditable(e.target)) {
    activeEl = e.target;
    showButton(e.target);
  } else {
    // Tab-navigated to a non-editable element
    hideButton();
  }
});

// Cover clicks on non-focusable areas (no focusin fires for those)
document.addEventListener('click', e => {
  if (e.target === btn) return;
  if (!isEditable(e.target)) {
    setTimeout(() => {
      if (!isEditable(document.activeElement)) hideButton();
    }, 0);
  }
});

// Reposition while the user scrolls or resizes
const reposition = () => { if (activeEl) showButton(activeEl); };
window.addEventListener('scroll', reposition, { capture: true, passive: true });
window.addEventListener('resize', reposition);

// ── Keyboard shortcut (Alt+C) ─────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.altKey && e.key === 'c') {
    e.preventDefault();
    applyConversion();
  }
});
