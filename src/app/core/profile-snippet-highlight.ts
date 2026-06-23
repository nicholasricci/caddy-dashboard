import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import go from 'highlight.js/lib/languages/go';
import javascript from 'highlight.js/lib/languages/javascript';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import type { ProfileSnippetLanguage } from './profile-register-snippets';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('python', python);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('go', go);
hljs.registerLanguage('php', php);

function highlightLanguage(language: ProfileSnippetLanguage): string {
  switch (language) {
    case 'shell':
      return 'bash';
    case 'python':
      return 'python';
    case 'javascript':
      return 'javascript';
    case 'go':
      return 'go';
    case 'php_laravel':
    case 'php_symfony':
      return 'php';
  }
}

export function highlightProfileSnippet(code: string, language: ProfileSnippetLanguage): string {
  return hljs.highlight(code, { language: highlightLanguage(language) }).value;
}
