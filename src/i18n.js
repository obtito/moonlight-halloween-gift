import { staticMessages } from './locales-static.js';
import { dynamicMessages } from './locales-dynamic.js';
import { extraMessages } from './locales-extra.js';
import { showMessages } from './locales-show.js';

export const languageStorageKey = 'moonlight-language';
export const supportedLanguages = Object.freeze(['ja', 'zh']);
export const messages = Object.fromEntries(supportedLanguages.map(language => [language, Object.freeze({
  ...staticMessages[language], ...dynamicMessages[language], ...extraMessages[language], ...showMessages[language],
})]));
const htmlLanguages = { ja: 'ja', zh: 'zh-CN' };
let currentLanguage = 'ja';
let activeDocument = null;
let activeStorage;
const listeners = new Set();
const boundDocuments = new WeakSet();
const boundWindows = new WeakSet();

export function getLanguage() { return currentLanguage; }

export function translate(language, key, parameters = {}) {
  const dictionary = messages[supportedLanguages.includes(language) ? language : 'ja'];
  const value = dictionary[key] ?? messages.ja[key] ?? key;
  return String(value).replace(/\{(\w+)\}/g, (placeholder, name) => Object.hasOwn(parameters, name) ? String(parameters[name]) : placeholder);
}

export function t(key, parameters = {}) { return translate(currentLanguage, key, parameters); }

function browserStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function readLanguage(storage = browserStorage()) {
  try {
    const value = storage?.getItem(languageStorageKey);
    return supportedLanguages.includes(value) ? value : 'ja';
  } catch { return 'ja'; }
}

function matchingElements(root, selector) {
  const elements = [...root.querySelectorAll(selector)];
  if (root.matches?.(selector)) elements.unshift(root);
  return elements;
}

export function translateDOM(root = activeDocument ?? globalThis.document) {
  if (!root?.querySelectorAll) return;
  for (const element of matchingElements(root, '[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of matchingElements(root, '[data-i18n-lines]')) {
    const doc = element.ownerDocument ?? activeDocument;
    const nodes = t(element.dataset.i18nLines).split('\n').flatMap((line, index) => index
      ? [doc.createElement('br'), doc.createTextNode(line)] : [doc.createTextNode(line)]);
    element.replaceChildren(...nodes);
  }
  for (const [attribute, dataKey] of [['aria-label', 'i18nAriaLabel'], ['title', 'i18nTitle'], ['placeholder', 'i18nPlaceholder'], ['content', 'i18nContent']]) {
    const selector = `[data-${dataKey.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}]`;
    for (const element of matchingElements(root, selector)) element.setAttribute(attribute, t(element.dataset[dataKey]));
  }
}

function updateDocument() {
  const doc = activeDocument;
  if (!doc) return;
  doc.documentElement.lang = htmlLanguages[currentLanguage];
  if (doc.body) doc.body.dataset.language = currentLanguage;
  translateDOM(doc);
  for (const button of doc.querySelectorAll('button[data-language]')) button.setAttribute('aria-pressed', String(button.dataset.language === currentLanguage));
}

export function setLanguage(language, { persist = true } = {}) {
  if (!supportedLanguages.includes(language)) return false;
  const changed = currentLanguage !== language;
  currentLanguage = language;
  if (persist) {
    try { (activeStorage ?? browserStorage())?.setItem(languageStorageKey, language); } catch { /* Switching still works when browser storage is unavailable. */ }
  }
  updateDocument();
  if (changed) for (const listener of [...listeners]) listener(language);
  return true;
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initI18n({ document: doc = globalThis.document, storage = browserStorage() } = {}) {
  activeDocument = doc ?? null;
  activeStorage = storage;
  currentLanguage = readLanguage(storage);
  updateDocument();
  if (doc && !boundDocuments.has(doc)) {
    doc.addEventListener('click', event => {
      const button = event.target.closest?.('button[data-language]');
      if (button) setLanguage(button.dataset.language);
    });
    boundDocuments.add(doc);
  }
  const win = doc?.defaultView;
  if (win && !boundWindows.has(win)) {
    win.addEventListener('storage', event => {
      if (event.key === languageStorageKey) setLanguage(supportedLanguages.includes(event.newValue) ? event.newValue : 'ja', { persist: false });
    });
    boundWindows.add(win);
  }
  return currentLanguage;
}
