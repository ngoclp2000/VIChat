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
