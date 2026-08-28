import logger from '#config/logger.js';
import bcrypt from 'bcrypt';
import { users } from '#models/users.model.js';
import { eq } from 'drizzle-orm';
import { db } from '#config/database.js';

export const hashPassword = async password => {
  try {
    return await bcrypt.hash(password, 10);
  } catch (e) {
    logger.error('Error hashing the password: ${e}');
    throw new Error('Error Hashing');
  }
};

export const createUser = async ({ name, email, password, role = 'user' }) => {
  try {
    const existingUser = await db
        .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingUser.length > 0) throw new Error(`User ${name} already exists`);

    const password_hash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({ name, email, password: password_hash, role })
      .returning({
        id: users.id,
        name: users.name,
        role: users.role,
        created_at: users.created_at,
      });

    logger.info(`User ${name} created successfully.`);
    return newUser
  } catch (e) {
    logger.error(`Error creating user: ${e}`);
    throw e;
  }
};
