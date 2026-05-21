import { useEffect } from 'react';
import { getLanguageMeta, LANGUAGE_CHANGED_EVENT, readLanguage, translatePhrase } from '../i18n/language';

const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_SELECTOR = [
  'script',
  'style',
  'textarea',
  'input',
  'select',
  'option',
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
  const leading = raw.match(/^\s*/)?.[0] || '';
  const trailing = raw.match(/\s*$/)?.[0] || '';
  const text = raw.trim().replace(/\s+/g, ' ');
  const translated = translatePhrase(text, language);
  if (translated && translated !== text) node.nodeValue = `${leading}${translated}${trailing}`;
}

function applyElementAttributes(element, language) {
  if (!element || shouldSkipNode(element)) return;
  TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
    const value = element.getAttribute(attribute);
    if (!value) return;
    const translated = translatePhrase(value, language);
    if (translated && translated !== value) element.setAttribute(attribute, translated);
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

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, handleLanguage);
    };
  }, []);

  return null;
}
