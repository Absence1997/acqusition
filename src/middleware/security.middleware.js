import aj from '#config/arcjet.js';
import {slidingWindow} from "@arcjet/node";
import logger from "#config/logger.js";
import req from "express/lib/request.js";

export default async function securityMiddleware(req, res, next) {
    try{

        const role = req.user ? (req.user.role || 'guest') : 'guest';

        let limit;
        let message;

        switch (role) {
            case 'admin':
                limit=20;
                message = 'Admin request limit exceeded (20 per minute). Please slow down.'
                break;
            case 'user':
                limit=10;
                message = 'User request limit exceeded (10 per minute). Please slow down.'
                break;
            case 'guest':
                limit=5;
                message = 'Guest request limit exceeded (5 per minute). Please slow down.'
                break;
        }

        const client = aj.withRule(slidingWindow({ mode: 'LIVE', interval: '1m', max: limit, name: `${role}-rate-limit`}))
        const decision = client.protect(req);

        if((await decision).isDenied() && (await decision).reason.isBot()){
            logger.warn('Bot request blocked', { ip: req.ip, userAgent: req.get('User-Agent'), path: req.path});

            return res.status(403).json({error: 'Forbidden', message: 'Automated requests are not allowed'});

        }
        if((await decision).isDenied() && (await decision).reason.isShield()){
            logger.warn('Shield blocked request', { ip: req.ip, userAgent: req.get('User-Agent'), path: req.path, method: req.method});

            return res.status(403).json({error: 'Forbidden', message: 'Request blocked by security policy'});

        }
        if((await decision).isDenied() && (await decision).reason.isRateLimit()){
            logger.warn('Rate limit exceeded!', { ip: req.ip, userAgent: req.get('User-Agent'), path: req.path});

            return res.status(403).json({error: 'Forbidden', message: 'Too many requests'});

        }

        next();
    }catch (e){
        console.error('Arcjet middleware error:', e);
            res.status(500).send({error: 'Internal server error:', message: 'Something went wrong.'});

    }

    //export default securityMiddleware;
}