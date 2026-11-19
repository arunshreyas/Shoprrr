import { db } from "./db.ts";
import { seed } from "./seed.ts";

export { db };

export interface StarterUser {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  createdAt: string | null;
}

export async function listUsers(limit = 10): Promise<StarterUser[]> {
  await seed();
  try {
    const customers = await db.orm.public.Customer.select("id", "name", "phone", "createdAt").limit(limit).all();

    return customers.map((customer) => ({
      id: String(customer.id),
      email: customer.phone ?? "no-phone",
      username: customer.name,
      name: customer.name,
      createdAt: customer.createdAt ? new Date(customer.createdAt).toISOString() : null,
    }));
  } catch {
    return [];
  }
}

