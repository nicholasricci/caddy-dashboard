// Language tab icons from https://simpleicons.org/ (CC0 1.0).

import type { ProfileSnippetLanguage } from '../core/profile-register-snippets';
import { siGnubash } from 'simple-icons/icons';
import { siGo } from 'simple-icons/icons';
import { siJavascript } from 'simple-icons/icons';
import { siLaravel } from 'simple-icons/icons';
import { siPython } from 'simple-icons/icons';
import { siSymfony } from 'simple-icons/icons';
import type { SimpleIcon } from 'simple-icons';

const LANGUAGE_ICONS: Record<ProfileSnippetLanguage, SimpleIcon> = {
  shell: siGnubash,
  python: siPython,
  javascript: siJavascript,
  go: siGo,
  php_laravel: siLaravel,
  php_symfony: siSymfony
};

export function languageIconSvg(language: ProfileSnippetLanguage, sizePx: number): string {
  const icon = LANGUAGE_ICONS[language];
  return icon.svg
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(
      '<svg role="img" viewBox',
      `<svg width="${sizePx}" height="${sizePx}" aria-hidden="true" focusable="false" class="block" fill="#${icon.hex}" viewBox`
    )
    .replace(' role="img"', '');
}
