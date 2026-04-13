import type { CaddyNodeV1 } from '../../models/api-v1.model';

/** Row model for the nodes table — decouples UI from optional API fields. */
export interface NodeListItemVm {
  id: string;
  name: string;
  status: string;
  private_ip: string;
  instance_id: string;
  region: string;
  ssm_enabled: boolean;
}

export function mapCaddyNodeV1ToListItem(dto: CaddyNodeV1): NodeListItemVm {
  return {
    id: dto.id ?? '',
    name: dto.name ?? '',
    status: dto.status ?? 'unknown',
    private_ip: dto.private_ip ?? '',
    instance_id: dto.instance_id ?? '',
    region: dto.region ?? '',
    ssm_enabled: !!dto.ssm_enabled
  };
}

/** Create-modal draft — same shape as API body, explicit for forms. */
export interface NodeCreateDraftVm {
  name: string;
  private_ip: string;
  instance_id: string;
  region: string;
  ssm_enabled: boolean;
}

export function mapNodeCreateDraftToPayload(draft: NodeCreateDraftVm): CaddyNodeV1 {
  return { ...draft };
}

export function defaultNodeCreateDraft(): NodeCreateDraftVm {
  return {
    name: '',
    private_ip: '',
    instance_id: '',
    region: '',
    ssm_enabled: true
  };
}
