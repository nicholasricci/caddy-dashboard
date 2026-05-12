import type { CaddyNodeV1, CaddyTransportV1 } from '../models/api-v1.model';

/** Backend: empty/missing `transport` after trim defaults to `aws_ssm`. */
export function normalizeCaddyTransport(dto: Pick<CaddyNodeV1, 'transport'>): CaddyTransportV1 {
  const raw = (dto.transport ?? '').trim();
  if (raw === 'ssh' || raw === 'http_admin' || raw === 'inventory_only' || raw === 'aws_ssm') {
    return raw;
  }
  return 'aws_ssm';
}
