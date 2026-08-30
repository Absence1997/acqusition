import logger from '../config/logger.js';
import { getAllUsers } from '../services/users.service.js';

export const fetchAllUsers = async (req, res, next) => {
  try{
    logger.info('Getting all users!');

    const allUsers = await getAllUsers();

    res.json({
      message: "Successfully retrieved all users",
      users: allUsers,
      count: allUsers.length,
    });
  }catch(e){
    logger.error(e);
    next(e);
  }
}