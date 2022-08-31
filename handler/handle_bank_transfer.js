import redis from 'redis';
import fetch from 'node-fetch';
import Web3 from 'web3';
import getEnvVar from '../util/get_env_var.js';
import getLogger from '../util/logger.js';
import CollateralizedLoanGateway from '../contracts/CollateralizedLoanGateway.json';
import TruffleContract from '@truffle/contract';

const adminBankAccountNo = getEnvVar('ADMIN_ACCOUNT_NO');
const openApiHost = getEnvVar('OPEN_API_HOST');
const redisPort = getEnvVar('REDIS_PORT');
const redisHost = getEnvVar('REDIS_HOST');

const handlePostLogin = (req, res) => {
    var logger = getLogger(bank_transfer);

    const redisClient = redis.createClient(redisPort, redisHost);

    if(!('username' in req.body && 'password' in req.body && 'userAddress' in req.body)) {
        res.status(400).send("Invalid request body");
        return null;
    }

    // Username and password have to be provided by the user
    const data = {
        "username": req.body.username
        , "password": req.body.password
    };

    // Call Open API endpoint POST /api/v1/auth/registry/user/login
    const requestSpec = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    };
    
    // Set the expiration of the token lifetime to 30 minutes in Redis
    const expireMinutes = 60 * 30;

    // Retrieve user token from the Open API
    const retrieveUserToken = async (url) => {
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
    retrieveUserToken(`http://${openApiHost}/api/v1/auth/registry/user/login`).then((resp) => {
        if(resp) {
            let token = JSON.parse(resp)['jwt-token'];
            redisClient.set('token:' + req.body.userAddress.toLowerCase().trim(), token, 'EX', expireMinutes, function (err, respFromRedis) {
                redisClient.get('token:' + req.body.userAddress.toLowerCase().trim(), (error, result) => {
                    // logger.debug('retrieveUserToken: ' + result);
                    logger.debug(`retrieved JWT for ${req.body.userAddress.toLowerCase().trim()}`);
                });
                
                if(err) {
                    logger.error(err);
                    res.status(404).send({'error': "Something wrong in admin login"});
                }
                
                // res.status(200).send(token);
                res.status(200).send({'message': "OK"});
            });
        } else {
            res.status(401).send({'error': "Invalid credential"});
        }
    }).catch((error) => {
        logger.error(error);
        res.status(500).send({'error': error});
    });
}

const handleGetUserAccountInfo = (req, res) => {
    var logger = getLogger(bank_transfer);

    let userAddress = req.params['userAddress'];

    const redisClient = redis.createClient(redisPort, redisHost);

    redisClient.on('connect', () => {
        logger.debug('Redis redisClient connected');
    });

    redisClient.get('token:' + userAddress.toLowerCase().trim(), async (error, token) => {
        if (error) {
            logger.error(error);
            throw error;
        }

        // Call Open API endpoint GET /api/v1/accountInfoEnquiry
        const requestSpec = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
                , 'Authorization': 'Bearer ' + token
            },
        };

        // Get account info of the current user
        const retrieveUserAccountInfo = async (url) => {
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

        // Only contains the account with USD balance
        retrieveUserAccountInfo(`http://${openApiHost}/api/v1/accountInfoEnquiry?currency=USD`).then((accountInfo) => {
            if(accountInfo) {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send(accountInfo);
            }
        }).catch((error) => {
            logger.error(error);
            res.status(500).send({'error': error});
        });

    });
}

const handlePostTransferFiatToDEX = (req, res) => {
    var logger = getLogger(bank_transfer);
    
    let userAddress = req.body.userAddress;
    let txnAmount = req.body.txnAmount;
    let bankAccountNo = req.body.bankAccountNo;

    const redisClient = redis.createClient(redisPort, redisHost);

    var web3 = new Web3();
    var collateralizedLoanGateway = TruffleContract(CollateralizedLoanGateway);
    collateralizedLoanGateway.setProvider(new web3.providers.HttpProvider("http://localhost:7545"));

    redisClient.on('connect', () => {
        logger.debug('Redis redisClient connected');
    });

    redisClient.get('token:' + userAddress.toLowerCase().trim(), async (error, token) => {
        if (error) {
            logger.error(error);
            throw error;
        }

        collateralizedLoanGateway.deployed().then((instance) => {
        
            // The transaction amount in USD will be deducted from the saving account
            // DR: deduct balance, CR: add balance
            // var txn = {
            //     "txnAmount": txnAmount
            //     , "currency": "USD"
            //     , "accountOp": "DR"
            // }

            var txn = {
                "fromAccount": bankAccountNo
                , "toAccount": adminBankAccountNo
                , "txnAmount": txnAmount
                , "currency": "USD"
            }

            // Call Open API endpoint GET /api/v1/accountTxn/
            const requestSpec = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    , 'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(txn)
            };

            // Get account info of the current user
            const transferFiatToDEX = async (url) => {
                logger.info('\n-------------------------transferFiatToDEX Start.-----------------------\n');

                try {
                    const response = await fetch(url, requestSpec);
                    return response.text().then(function (resp) {
                        try {
                            logger.info('Response status: ' + response.status);
                            if(response.status === 200) {
                                logger.info('Response from Open API: ' + JSON.stringify(JSON.parse(resp), null, 2));
                            } else {
                                logger.error('Error from Open API: ' + resp);
                            }

                            // Make sure the response status from Open API is 200 OK
                            if(response.status != 200) {
                                return false;
                            } else {
                                return true;
                            }
                        } catch(error) {
                            logger.error(error);
                            return false;
                        }
                    });
                    
                } catch (err) {
                    return false;
                }
            }

            // Only contains the account with USD balance
            transferFiatToDEX(`http://${openApiHost}/api/v1/fundTransfer`).then((success) => {
                if(success) {
                    instance.storeFiatMoney(userAddress, txnAmount, {from: userAddress}).then((response, err) => {
                        if(!err){
                            logger.debug(`Fiat transfer to Platform completed for address ${userAddress}, account number ${bankAccountNo} with txnAmount ${txnAmount}`);
                            logger.info('\n-------------------------transferFiatToDEX End.-------------------------\n');
                            res.status(200).send({'message': "OK"});
                        } else {
                            logger.error(`Fiat transfer to Platform failed when calling smart contract for address ${userAddress}, account number ${bankAccountNo} with txnAmount ${txnAmount}`);
                            logger.info('\n-------------------------transferFiatToDEX End.-------------------------\n');
                            res.status(500).send({'error': 'Fiat transfer to Platform failed when calling smart contract'});
                        }
                    });
                } else {
                    logger.error(`Fiat transfer to Platform failed when calling Open API for address ${userAddress}, account number ${bankAccountNo} with txnAmount ${txnAmount}`);
                    logger.info('\n-------------------------transferFiatToDEX End.-------------------------\n');
                    res.status(500).send({'error': 'Fiat transfer to Platform failed when calling Open API'});
                }
            }).catch((error) => {
                logger.error(error);
                logger.info('\n-------------------------transferFiatToDEX End.-------------------------\n');
                res.status(500).send({'error': error});
            });
        });
    });
}

export {
    handlePostLogin,
    handleGetUserAccountInfo,
    handlePostTransferFiatToDEX,
};