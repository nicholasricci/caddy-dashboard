import { normalizeCaddyTransport } from './caddy-node-transport.util';

describe('normalizeCaddyTransport', () => {
  it('defaults empty to aws_ssm', () => {
    expect(normalizeCaddyTransport({})).toBe('aws_ssm');
    expect(normalizeCaddyTransport({ transport: '   ' })).toBe('aws_ssm');
  });

  it('accepts valid transports', () => {
    expect(normalizeCaddyTransport({ transport: 'ssh' })).toBe('ssh');
    expect(normalizeCaddyTransport({ transport: 'http_admin' })).toBe('http_admin');
  });
});
