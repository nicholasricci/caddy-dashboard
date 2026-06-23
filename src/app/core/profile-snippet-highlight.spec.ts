import { highlightProfileSnippet } from './profile-snippet-highlight';
import { profileRegisterSnippet } from './profile-register-snippets';

describe('profile-snippet-highlight', () => {
  const sampleCode = profileRegisterSnippet('upstream', 'shell', {
    baseUrl: 'https://api.example.com/api/v1',
    profileId: 'prof-1'
  });

  it('highlights shell snippets with hljs spans', () => {
    const html = highlightProfileSnippet(sampleCode, 'shell');
    expect(html).toContain('hljs-');
  });

  it('highlights python snippets with hljs spans', () => {
    const code = profileRegisterSnippet('upstream', 'python', {
      baseUrl: 'https://api.example.com/api/v1',
      profileId: 'prof-1'
    });
    const html = highlightProfileSnippet(code, 'python');
    expect(html).toContain('hljs-');
  });

  it('highlights javascript snippets with hljs spans', () => {
    const code = profileRegisterSnippet('upstream', 'javascript', {
      baseUrl: 'https://api.example.com/api/v1',
      profileId: 'prof-1'
    });
    const html = highlightProfileSnippet(code, 'javascript');
    expect(html).toContain('hljs-');
  });

  it('highlights go snippets with hljs spans', () => {
    const code = profileRegisterSnippet('upstream', 'go', {
      baseUrl: 'https://api.example.com/api/v1',
      profileId: 'prof-1'
    });
    const html = highlightProfileSnippet(code, 'go');
    expect(html).toContain('hljs-');
  });

  it('highlights laravel snippets as php', () => {
    const code = profileRegisterSnippet('domain', 'php_laravel', {
      baseUrl: 'https://api.example.com/api/v1',
      profileId: 'dprof-1'
    });
    const html = highlightProfileSnippet(code, 'php_laravel');
    expect(html).toContain('hljs-');
  });

  it('highlights symfony snippets as php', () => {
    const code = profileRegisterSnippet('domain', 'php_symfony', {
      baseUrl: 'https://api.example.com/api/v1',
      profileId: 'dprof-1'
    });
    const html = highlightProfileSnippet(code, 'php_symfony');
    expect(html).toContain('hljs-');
  });
});
