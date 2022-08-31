import redis from 'redis';
import fetch from 'node-fetch';
import getEnvVar from '../util/get_env_var.js';
import getLogger from '../util/logger.js';

const openApiHost = getEnvVar('OPEN_API_HOST');
const ainodeAdminAPILoginAccount = getEnvVar('AIRNODE_ADMIN_API_LOGIN_ACCOUNT');
const ainodeAdminAPILoginPassword = getEnvVar('AIRNODE_ADMIN_API_LOGIN_PASSWORD');
const redisPort = getEnvVar('REDIS_PORT');
const redisHost = getEnvVar('REDIS_HOST');

const loggerName = 'update_admin_token';

const handleAdminLogin = () => {
    var logger = getLogger(loggerName);

    const redisClient = redis.createClient(redisPort, redisHost);

    // Username and password have to be provided by the user
    const crendentials = {
        "username": ainodeAdminAPILoginAccount
        , "password": ainodeAdminAPILoginPassword
    };

    // Call Open API endpoint POST /api/v1/auth/registry/user/login
    const requestSpec = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crendentials)
    };
    
    // Set the expiration of the token lifetime to 30 minutes in Redis
    const expireMinutes = 60 * 30;

    // Retrieve admin token from the Open API
    const retrieveAdminToken = async (url) => {
        try {
            const response = await fetch(url, requestSpec);
            return response.text().then(function (token) {
                return token;
            });
        } catch (err) {
            logger.error(err);
            return null;
        }
    }

    // If account name and password are valid, the token will be successfully generated and stored in Redis
    // Otherwise, return "Invalid credential" back to user
    retrieveAdminToken(`http://${openApiHost}/api/v1/auth/registry/user/login`).then((resp) => {
        if(resp) {
            let token = JSON.parse(resp)['jwt-token'];
            redisClient.set('token_admin', token, 'EX', expireMinutes, function (err, respFromRedis) {
                redisClient.get('token_admin', (error, result) => {
                    // logger.debug('retrieveUserToken: ' + result);
                    logger.debug(`retrieved JWT for admin`);
                });
                
                if(err) {
                    logger.error(err);
                }
                
            });
        } else {
            logger.error("No resp");
        }
    }).catch((error) => {
        logger.error(error);
    });
}

const adminLogin = () => {
    /**
     * Automatically perform admin login in Open API and retrieve admin token, frequency: every 5 minutes
     */
    var logger = getLogger(loggerName);
    try {
        handleAdminLogin();
    } catch (err) {
        logger.error("adminLogin");
        logger.error(err);
    }
}

export {
    adminLogin
};