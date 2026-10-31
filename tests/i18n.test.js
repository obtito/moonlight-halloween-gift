import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { messages, supportedLanguages, getLanguage, initI18n, readLanguage, setLanguage, onLanguageChange, translate, t, languageStorageKey } from '../src/i18n.js';

test('every visitor-facing translation exists in Japanese and Chinese with matching parameters', () => {
  assert.deepEqual(supportedLanguages, ['ja', 'zh']);
  const keys = Object.keys(messages.ja).sort();
  assert.ok(keys.length > 100);
  const parameters = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const language of supportedLanguages) {
    assert.deepEqual(Object.keys(messages[language]).sort(), keys, `${language} has missing translations`);
    for (const key of keys) {
      assert.equal(typeof messages[language][key], 'string', `${language}:${key}`);
      assert.ok(messages[language][key].trim(), `${language}:${key} is blank`);
      assert.deepEqual(parameters(messages[language][key]), parameters(messages.ja[key]), `${language}:${key} parameters differ`);
    }
  }
});

test('every static DOM binding resolves to translated copy', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-lines|-aria-label|-title|-placeholder|-content)?="([^"]+)"/g)].map(match => match[1]);
  assert.ok(keys.length > 80);
  for (const key of keys) for (const language of supportedLanguages) assert.ok(Object.hasOwn(messages[language], key), `${language}:${key}`);
  assert.match(html, /<html lang="ja">/);
  for (const language of supportedLanguages) assert.match(html, new RegExp(`data-language="${language}"`));
  assert.doesNotMatch(html, /data-language="en"/);
  const credits = readFileSync(new URL('../public/credits.html', import.meta.url), 'utf8');
  assert.doesNotMatch(credits, /data-language="en"/);
});

test('literal translation keys used by dynamic UI, models and canvas all resolve', () => {
  for (const file of ['main.js', 'world.js', 'model-slot.js']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    const keys = [...source.matchAll(/['"]((?:static|dynamic|extra|show)\.[\w.]+)['"]/g)].map(match => match[1]);
    for (const key of keys) for (const language of supportedLanguages) assert.ok(Object.hasOwn(messages[language], key), `${file}:${language}:${key}`);
  }
});

test('Japanese is the first-visit default and unavailable storage does not prevent switching', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readLanguage(storage), 'ja');
  initI18n({ document: undefined, storage });
  assert.equal(getLanguage(), 'ja');
  assert.equal(setLanguage('zh'), true);
  assert.equal(getLanguage(), 'zh');
  assert.equal(t('static.noticeTitle'), messages.zh['static.noticeTitle']);
  assert.equal(setLanguage('en'), false);
  assert.equal(setLanguage('unsupported'), false);
  assert.equal(getLanguage(), 'zh');
  assert.equal(readLanguage({ getItem: () => 'en' }), 'ja');
});

test('language choices persist, restore and notify without recreating application state', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  initI18n({ document: undefined, storage });
  const changes = [];
  const stop = onLanguageChange(language => changes.push(language));
  setLanguage('zh'); setLanguage('zh'); setLanguage('ja');
  assert.deepEqual(changes, ['zh', 'ja']);
  assert.equal(values.get(languageStorageKey), 'ja');
  stop(); setLanguage('zh');
  assert.deepEqual(changes, ['zh', 'ja']);
  setLanguage('zh');
  assert.equal(initI18n({ document: undefined, storage }), 'zh');
  values.set(languageStorageKey, 'bad-locale');
  assert.equal(readLanguage(storage), 'ja');
  setLanguage('ja', { persist: false });
});

test('interpolated values are literal text and unsupported language lookup falls back to Japanese', () => {
  const key = Object.keys(messages.zh).find(key => /\{\w+\}/.test(messages.zh[key]));
  assert.ok(key, 'at least one dynamic message is parameterized');
  const names = [...messages.zh[key].matchAll(/\{(\w+)\}/g)].map(match => match[1]);
  const literal = '<img src=x onerror=alert(1)> $&';
  const parameters = Object.fromEntries(names.map(name => [name, literal]));
  assert.ok(translate('zh', key, parameters).includes(literal));
  assert.equal(translate('bad-locale', 'static.noticeTitle'), messages.ja['static.noticeTitle']);
});
