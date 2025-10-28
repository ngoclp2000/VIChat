export interface Tenant {
  id: string;
  name: string;
  clientId: string;
  apiKey: string;
  plan: 'free' | 'pro' | 'enterprise';
  limits: {
    messagesPerMinute: number;
    callsPerMinute: number;
  };
}

const tenants = new Map<string, Tenant>();

export function seedTenants(): void {
  tenants.clear();
  tenants.set('tenant-demo', {
    id: 'tenant-demo',
    name: 'Demo Tenant',
    clientId: 'demo-app',
    apiKey: 'demo-secret',
    plan: 'pro',
    limits: {
      messagesPerMinute: 120,
      callsPerMinute: 20
    }
  });
}

export function getTenantByClientId(clientId: string): Tenant | undefined {
  return Array.from(tenants.values()).find((tenant) => tenant.clientId === clientId);
}

export function getTenantById(id: string): Tenant | undefined {
  return tenants.get(id);
}

export function listTenants(): Tenant[] {
  return Array.from(tenants.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
}

export interface CreateTenantInput {
  id: string;
  name: string;
  clientId: string;
  apiKey: string;
  plan?: Tenant['plan'];
  limits?: Partial<Tenant['limits']>;
}

export function createTenant(input: CreateTenantInput): Tenant {
  const id = input.id.trim();
  if (!id) {
    throw new Error('TENANT_ID_REQUIRED');
  }

  const name = input.name.trim() || id;
  const clientId = input.clientId.trim();
  const apiKey = input.apiKey.trim();

  if (!clientId) {
    throw new Error('CLIENT_ID_REQUIRED');
  }

  if (!apiKey) {
    throw new Error('API_KEY_REQUIRED');
  }

  if (tenants.has(id)) {
    throw new Error('TENANT_EXISTS');
  }

  const existingClient = Array.from(tenants.values()).find((tenant) => tenant.clientId === clientId);
  if (existingClient) {
    throw new Error('CLIENT_EXISTS');
  }

  const plan = input.plan ?? 'free';
  const limits = {
    messagesPerMinute: input.limits?.messagesPerMinute ?? (plan === 'enterprise' ? 1000 : plan === 'pro' ? 240 : 60),
    callsPerMinute: input.limits?.callsPerMinute ?? (plan === 'enterprise' ? 100 : plan === 'pro' ? 40 : 10)
  };

  const tenant: Tenant = {
    id,
    name,
    clientId,
    apiKey,
    plan,
    limits
  };

  tenants.set(id, tenant);
  return tenant;
}
