import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { ObjectId, type Db } from 'mongodb';

export interface TenantUserRecord {
  _id: ObjectId;
  tenantId: string;
  userId: string;
  displayName: string;
  passwordHash: string;
  roles: string[];
  status: 'active' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
}

export interface TenantUserProfile {
  userId: string;
  displayName: string;
  roles: string[];
  status: 'active' | 'disabled';
  lastLoginAt?: string | null;
}

export interface TenantUserDirectoryEntry {
  userId: string;
  displayName: string;
}

export interface CreateTenantUserInput {
  userId: string;
  displayName: string;
  password: string;
  roles?: string[];
  status?: 'active' | 'disabled';
}

const COLLECTION_NAME = 'tenantUsers';

interface SeedUserInput {
  tenantId: string;
  userId: string;
  displayName: string;
  password: string;
  roles: string[];
}

export async function seedUsers(db: Db): Promise<void> {
  const collection = db.collection<TenantUserRecord>(COLLECTION_NAME);
  const seeds: SeedUserInput[] = [
    {
      tenantId: 'tenant-demo',
      userId: 'user:demo',
      displayName: 'Demo User',
      password: 'demo-password',
      roles: ['member']
    },
    {
      tenantId: 'tenant-demo',
      userId: 'user:support',
      displayName: 'Support Agent',
      password: 'support-password',
      roles: ['support']
    }
  ];

  const now = new Date();

  for (const seed of seeds) {
    const existing = await collection.findOne({ tenantId: seed.tenantId, userId: seed.userId });

    let passwordHash = existing?.passwordHash;
    if (!passwordHash || !verifySecret(seed.password, passwordHash)) {
      passwordHash = hashSecret(seed.password);
    }

    if (existing) {
      await collection.updateOne(
        { _id: existing._id },
        {
          $set: {
            displayName: seed.displayName,
            roles: seed.roles,
            status: 'active',
            passwordHash,
            updatedAt: now
          }
        }
      );
    } else {
      await collection.insertOne({
        _id: new ObjectId(),
        tenantId: seed.tenantId,
        userId: seed.userId,
        displayName: seed.displayName,
        passwordHash: passwordHash!,
        roles: seed.roles,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null
      });
    }
  }
}

export async function listTenantUsers(db: Db, tenantId: string): Promise<TenantUserProfile[]> {
  const collection = db.collection<TenantUserRecord>(COLLECTION_NAME);
  const users = await collection
    .find({ tenantId })
    .sort({ displayName: 1 })
    .toArray();

  return users.map((user): TenantUserProfile => ({
    userId: user.userId,
    displayName: user.displayName,
    roles: user.roles,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null
  }));
}

export async function listPublicTenantUsers(
  db: Db,
  tenantId: string
): Promise<TenantUserDirectoryEntry[]> {
  const collection = db.collection<TenantUserRecord>(COLLECTION_NAME);
  const users = await collection
    .find({ tenantId, status: 'active' })
    .project({ userId: 1, displayName: 1, _id: 0 })
    .sort({ displayName: 1 })
    .toArray();

  return users.map((user) => ({
    userId: user.userId,
    displayName: user.displayName
  }));
}

export async function verifyTenantUserSecret(
  db: Db,
  tenantId: string,
  userId: string,
  secret: string
): Promise<TenantUserRecord | null> {
  const collection = db.collection<TenantUserRecord>(COLLECTION_NAME);
  const user = await collection.findOne({ tenantId, userId });
  if (!user) return null;
  if (user.status !== 'active') return null;

  const matches = verifySecret(secret, user.passwordHash);
  if (!matches) return null;

  const now = new Date();
  await collection.updateOne(
    { _id: user._id },
    {
      $set: {
        lastLoginAt: now,
        updatedAt: now
      }
    }
  );

  return { ...user, lastLoginAt: now, updatedAt: now };
}

export async function assertUsersBelongToTenant(db: Db, tenantId: string, userIds: string[]): Promise<void> {
  if (!userIds.length) return;

  const collection = db.collection<TenantUserRecord>(COLLECTION_NAME);
  const uniqueIds = Array.from(new Set(userIds));
  const records = await collection
    .find({ tenantId, userId: { $in: uniqueIds }, status: 'active' })
    .project({ userId: 1 })
    .toArray();

  const knownIds = new Set(records.map((record: { userId: string }) => record.userId));
  const missing = uniqueIds.filter((id) => !knownIds.has(id));
  if (missing.length) {
    throw new Error(`Unknown or inactive users: ${missing.join(', ')}`);
  }
}

export async function getTenantUser(db: Db, tenantId: string, userId: string): Promise<TenantUserRecord | null> {
  const collection = db.collection<TenantUserRecord>(COLLECTION_NAME);
  const user = await collection.findOne({ tenantId, userId });
  return user ?? null;
}

export async function createTenantUser(
  db: Db,
  tenantId: string,
  input: CreateTenantUserInput
): Promise<TenantUserProfile> {
  const collection = db.collection<TenantUserRecord>(COLLECTION_NAME);
  const userId = input.userId.trim();
  const displayName = (input.displayName || input.userId).trim();
  const password = input.password.trim();

  if (!userId) {
    throw new Error('USER_ID_REQUIRED');
  }

  if (!password) {
    throw new Error('PASSWORD_REQUIRED');
  }

  const existing = await collection.findOne({ tenantId, userId });
  if (existing) {
    throw new Error('USER_EXISTS');
  }

  const roles = Array.from(
    new Set(
      (input.roles ?? ['member'])
        .map((role) => role.trim())
        .filter((role): role is string => Boolean(role))
    )
  );

  const now = new Date();
  const record: TenantUserRecord = {
    _id: new ObjectId(),
    tenantId,
    userId,
    displayName: displayName || userId,
    passwordHash: hashSecret(password),
    roles,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null
  };

  await collection.insertOne(record);

  return {
    userId: record.userId,
    displayName: record.displayName,
    roles: record.roles,
    status: record.status,
    lastLoginAt: record.lastLoginAt ?? null
  };
}

function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(secret, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

function verifySecret(secret: string, digest: string): boolean {
  const [saltHex, hashHex] = digest.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(secret, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
