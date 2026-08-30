import logger from '../config/logger.js';
import { db } from '../config/database.js';
// ✅ fixed — matches your actual models file
import { users } from '../models/users.model.js';

export const getAllUsers = async() => {
  try{
    return await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      created_at: users.created_at,
      updated_at: users.updated_at,
    }).from(users);
  }catch(e){
    logger.error('Error getting users', e);
    throw error;
  }
}