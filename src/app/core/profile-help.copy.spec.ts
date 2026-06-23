import {
  exampleDomainProfileCurl,
  exampleUpstreamProfileCurl,
  UPSTREAM_PROFILE_SUMMARY
} from './profile-help.copy';

describe('profile-help.copy', () => {
  const baseUrl = 'https://api.example.com/api/v1';

  it('exports non-empty summary copy', () => {
    expect(UPSTREAM_PROFILE_SUMMARY.length).toBeGreaterThan(20);
  });

  it('exampleUpstreamProfileCurl includes profile register path and private_ip body', () => {
    const curl = exampleUpstreamProfileCurl(baseUrl, 'prof-abc', 'cdk_live_test');

    expect(curl).toContain('/upstream-profiles/prof-abc/register');
    expect(curl).toContain('"private_ip":"10.0.0.42"');
    expect(curl).toContain('Authorization: cdk_live_test');
  });

  it('exampleDomainProfileCurl includes profile register path and domains body', () => {
    const curl = exampleDomainProfileCurl(baseUrl, 'dprof-xyz', 'cdk_live_test');

    expect(curl).toContain('/domain-profiles/dprof-xyz/register');
    expect(curl).toContain('"domains":["acme.example.com"]');
    expect(curl).toContain('Authorization: cdk_live_test');
  });

  it('normalizes trailing slash on base URL', () => {
    const curl = exampleUpstreamProfileCurl(`${baseUrl}/`, 'prof-1');

    expect(curl).toContain('https://api.example.com/api/v1/upstream-profiles/prof-1/register');
    expect(curl).not.toContain('/api/v1//upstream-profiles');
  });
});
