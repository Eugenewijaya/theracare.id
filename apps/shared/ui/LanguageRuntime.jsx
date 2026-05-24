import { useEffect } from 'react';
import {
  getLanguageMeta,
  LANGUAGE_CHANGED_EVENT,
  LANGUAGE_STORAGE_KEY,
  readLanguage,
  translateText,
} from '../i18n/language';

const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_SELECTOR = [
  'script',
  'style',
  'textarea',
  'input',
  '[contenteditable="true"]',
  '[data-no-translate]',
  '.notranslate',
  '.material-symbols-outlined',
].join(',');

const textOriginals = new WeakMap();
const textTranslations = new WeakMap();
const attributeOriginals = new WeakMap();
const attributeTranslations = new WeakMap();
const ATTRIBUTE_SKIP_SELECTOR = [
  'script',
  'style',
  '[contenteditable="true"]',
  '[data-no-translate]',
  '.notranslate',
  '.material-symbols-outlined',
].join(',');

function shouldSkipNode(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return !element || element.closest(SKIP_SELECTOR);
}

function applyTextTranslation(node, language) {
  if (!node?.nodeValue || !node.nodeValue.trim() || shouldSkipNode(node)) return;
  const raw = node.nodeValue;
  const previousOriginal = textOriginals.get(node);
  const previousTranslation = textTranslations.get(node);
  const sourceChanged = !previousOriginal || (previousTranslation && raw !== previousTranslation && raw !== previousOriginal);
  const original = sourceChanged ? raw : previousOriginal;
  textOriginals.set(node, original);

  const leading = raw.match(/^\s*/)?.[0] || '';
  const trailing = raw.match(/\s*$/)?.[0] || '';
  const text = String(original || '').trim().replace(/\s+/g, ' ');
  const translated = translateText(text, language);
  const next = translated && translated !== text ? `${leading}${translated}${trailing}` : original;
  textTranslations.set(node, next);
  if (next !== raw) node.nodeValue = next;
}

function applyElementAttributes(element, language) {
  if (!element || element.closest(ATTRIBUTE_SKIP_SELECTOR)) return;
  TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
    const value = element.getAttribute(attribute);
    if (!value) return;
    let originals = attributeOriginals.get(element);
    let translations = attributeTranslations.get(element);
    if (!originals) {
      originals = {};
      attributeOriginals.set(element, originals);
    }
    if (!translations) {
      translations = {};
      attributeTranslations.set(element, translations);
    }
    if (!originals[attribute] || (translations[attribute] && value !== translations[attribute] && value !== originals[attribute])) {
      originals[attribute] = value;
    }
    const translated = translateText(originals[attribute], language);
    const next = translated || originals[attribute];
    translations[attribute] = next;
    if (next !== value) element.setAttribute(attribute, next);
  });
}

function applyTranslations(root = document.body, language = readLanguage()) {
  if (!root) return;
  document.documentElement.lang = getLanguageMeta(language).htmlLang;

  if (root.nodeType === Node.TEXT_NODE) {
    applyTextTranslation(root, language);
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) applyElementAttributes(root, language);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) applyTextTranslation(node, language);
    if (node.nodeType === Node.ELEMENT_NODE) applyElementAttributes(node, language);
    node = walker.nextNode();
  }
}

export default function LanguageRuntime() {
  useEffect(() => {
    if (typeof window === 'undefined' || !document.body) return undefined;
    let language = readLanguage();
    let frame = null;
    let muted = false;

    const schedule = (root = document.body) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        muted = true;
        applyTranslations(root, language);
        muted = false;
        frame = null;
      });
    };

    const handleLanguage = (event) => {
      language = event.detail?.language || readLanguage();
      schedule(document.body);
    };
    const handleStorage = (event) => {
      if (event.key !== LANGUAGE_STORAGE_KEY) return;
      language = readLanguage();
      schedule(document.body);
    };

    const observer = new MutationObserver((mutations) => {
      if (muted) return;
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          schedule(mutation.target);
          return;
        }
        if (mutation.addedNodes?.length) {
          schedule(document.body);
          return;
        }
      }
    });

    schedule(document.body);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener(LANGUAGE_CHANGED_EVENT, handleLanguage);
    window.addEventListener('storage', handleStorage);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, handleLanguage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return null;
}
