import {
  PROFILE_SNIPPET_LANGUAGES,
  PROFILE_SNIPPET_PLACEHOLDER_KEY,
  profileRegisterSnippet
} from './profile-register-snippets';

describe('profile-register-snippets', () => {
  const baseUrl = 'https://api.example.com/api/v1';
  const profileId = 'prof-abc123';
  const testSecret = 'cdk_live_once_only';

  it('defines six snippet languages', () => {
    expect(PROFILE_SNIPPET_LANGUAGES.length).toBe(6);
    expect(PROFILE_SNIPPET_LANGUAGES.map(l => l.label)).toContain('PHP (Laravel)');
    expect(PROFILE_SNIPPET_LANGUAGES.map(l => l.label)).toContain('PHP (Symfony)');
  });

  for (const language of PROFILE_SNIPPET_LANGUAGES) {
    it(`upstream ${language.id} includes profile id`, () => {
      const snippet = profileRegisterSnippet('upstream', language.id, { baseUrl, profileId });
      expect(snippet).toContain(profileId);
    });

    it(`domain ${language.id} includes profile id`, () => {
      const snippet = profileRegisterSnippet('domain', language.id, { baseUrl, profileId });
      expect(snippet).toContain(profileId);
    });
  }

  it('uses placeholder key when apiKey is omitted', () => {
    for (const language of PROFILE_SNIPPET_LANGUAGES) {
      const snippet = profileRegisterSnippet('upstream', language.id, { baseUrl, profileId });
      expect(snippet).toContain(PROFILE_SNIPPET_PLACEHOLDER_KEY);
      expect(snippet).not.toContain(testSecret);
    }
  });

  it('inlines real api key when provided', () => {
    for (const language of PROFILE_SNIPPET_LANGUAGES) {
      const snippet = profileRegisterSnippet('upstream', language.id, {
        baseUrl,
        profileId,
        apiKey: testSecret
      });
      expect(snippet).toContain(testSecret);
    }
  });

  it('upstream shell contains private_ip body', () => {
    const snippet = profileRegisterSnippet('upstream', 'shell', { baseUrl, profileId });
    expect(snippet).toContain('private_ip');
    expect(snippet).toContain('/upstream-profiles/');
  });

  it('domain shell contains domains body', () => {
    const snippet = profileRegisterSnippet('domain', 'shell', { baseUrl, profileId });
    expect(snippet).toContain('domains');
    expect(snippet).toContain('/domain-profiles/');
  });

  it('php laravel snippet uses Http facade', () => {
    const snippet = profileRegisterSnippet('upstream', 'php_laravel', { baseUrl, profileId });
    expect(snippet).toContain('Http::');
    expect(snippet).toContain('Illuminate\\Support\\Facades\\Http');
  });

  it('php symfony snippet uses HttpClient', () => {
    const snippet = profileRegisterSnippet('domain', 'php_symfony', { baseUrl, profileId });
    expect(snippet).toContain('HttpClient::create');
    expect(snippet).toContain('Symfony\\Component\\HttpClient\\HttpClient');
  });
});
