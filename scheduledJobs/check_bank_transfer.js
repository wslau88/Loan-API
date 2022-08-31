import redis from 'redis';
import fetch from 'node-fetch';
import Web3 from 'web3';
import getEnvVar from '../util/get_env_var.js';
import CollateralizedLoanGateway from '../contracts/CollateralizedLoanGateway.json';
import TruffleContract from '@truffle/contract';
import getLogger from '../util/logger.js';

const loggerName = 'check_bank_transfer';
const admin = getEnvVar('ADMIN_WALLET_ADDRESS');
const adminBankAccountNo = getEnvVar('ADMIN_ACCOUNT_NO');
const openApiHost = getEnvVar('OPEN_API_HOST');
const redisPort = getEnvVar('REDIS_PORT');
const redisHost = getEnvVar('REDIS_HOST');

const handleFulfillFiatTransferredRequest = () => {
    var logger = getLogger(loggerName);
    
    const redisClient = redis.createClient(redisPort, redisHost);

    let web3 = new Web3();
    var collateralizedLoanGateway = TruffleContract(CollateralizedLoanGateway);
    collateralizedLoanGateway.setProvider(new web3.providers.HttpProvider("http://localhost:7545"));
    
    let logStart = 0;
    const logEnd = 'latest';
    const topic = 'FiatMoneyTransferredToBank';

    // Read the logs starting from last read log/block Index, and ending at last generated block index
    redisClient.get(`lastRead${topic}LogIndex`, (error, result) => {
        logger.debug(`lastRead${topic}LogIndex ->` + result);


        // Start from last end block index + 1
        if(result) {
            logStart = parseInt(result) + 1;
        }

        logger.debug('Event log range: ', logStart, ' to ',  logEnd);

        collateralizedLoanGateway.deployed().then((instance) => {
            instance.getPastEvents(topic, {fromBlock: logStart, toBlock: logEnd}).then((eventArr, err) => {
                redisClient.on('connect', () => {
                    logger.debug('Redis redisClient connected');
                });
    
                let logCount = 0;
                let lastBlockNumber = 0;
                
                let updateAccountAndDEXBalance = async function(i){
                    // A single requestSpec from the event log
                    let event = eventArr[i];

                    // Check if the user token is stored is Redis by matching the user address
                    redisClient.get('token_admin', async (error, token) => {

                        if (error) {
                            logger.error(error);
                            throw error;
                        }

                        if(token === null || token === undefined) {
                            // TODO: admin token not found in redis
                        }
                        
                        // The transaction amount in USD will be added to the saving account
                        // DR: deduct balance, CR: add balance
                        // var txn = {
                        //     "txnAmount": event.returnValues['_value']
                        //     , "currency": "USD"
                        //     , "accountOp": "CR"
                        // }

                        var txn = {
                            "fromAccount": adminBankAccountNo
                            , "toAccount": event.returnValues['_bankAccountNo']
                            , "txnAmount": event.returnValues['_value']
                            , "currency": "USD"
                        }

                        // Call Open API endpoint POST /api/v1/accountTxn/{accountNo}
                        const requestSpec = {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                                , 'Authorization': 'Bearer ' + token
                            },
                            body: JSON.stringify(txn)
                        };
                    
                        // Submit the transaction to the Open API endpoint
                        const submitTxn = async (url) => {
                            logger.info('\n-------------------------fulfillFiatTransferredRequest Start.-----------------------\n');
                            try {
                                const response = await fetch(url, requestSpec);
                                return response.text().then(function (resp) {
                                    try {
                                        logger.info('Response status: ' + response.status);
                                        if(response.status === 200) {
                                            logger.info('Response from Open API: ' + JSON.stringify(JSON.parse(resp), null, 2));
                                        } else {
                                            logger.debug('Error from Open API: ' + resp);
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

                        // Submit the transaction to Open API endpoint
                        // If success, the fiat balance on the Transactions contract will be deducted
                        // Otherwise, the fiat balance will not be updated
                        submitTxn(`http://${openApiHost}/api/v1/fundTransfer`).then((success) => {
                            if(success) {
                                instance.withdrawFiatMoney(event.returnValues['_address'], event.returnValues['_value'], {from: admin}).then((response, err) => {
                                    if(!err){
                                        logger.info(`Fiat transfer to bank completed for address ${event.returnValues['_address']}, account number ${event.returnValues['_bankAccountNo']} with txnAmount ${event.returnValues['_value']}`);
                                        logger.info('\n-------------------------fulfillFiatTransferredRequest End.-------------------------\n');
                                    } else {
                                        logger.error(err);
                                        logger.error(`Fiat transfer to bank failed for address ${event.returnValues['_address']}, account number ${event.returnValues['_bankAccountNo']} with txnAmount ${event.returnValues['_value']}`);
                                        logger.error(`${topic} at block ${event.blockNumber}: Error occurred on the side of CollateralizedLoanGateway`);
                                        logger.info('\n-------------------------fulfillFiatTransferredRequest End.-------------------------\n');
                                    }
                                    
                                });
                            } else {
                                logger.error(`Fiat transfer to Platform failed when calling Open API for address ${event.returnValues['_address']}, account number ${event.returnValues['_bankAccountNo']} with txnAmount ${event.returnValues['_value']}`);
                                logger.info('\n-------------------------fulfillFiatTransferredRequest End.-------------------------\n');
                            }
                        }).catch((error) => {
                            logger.error(error);
                            logger.info('\n-------------------------fulfillFiatTransferredRequest End.-------------------------\n');
                        });
                    });
                
                    logCount++;
                    lastBlockNumber = event.blockNumber;
                    logger.info('logCount: ' + logCount);
                }

                // A timeout function for setting delay between async operations
                let timeout = (ms) => {
                    return new Promise(resolve => setTimeout(resolve, ms));
                }
                
                // Update the account balance with 0.1 second interval delay
                let main = async () => {
                    var i = 0;
                    while (i < eventArr.length) {
                        await Promise.all([
                            updateAccountAndDEXBalance(i),
                            timeout(100)
                        ]);

                        i++;
                    }
                }

                // Execute the main function
                main();
    
                // Record down the last read log/block index
                redisClient.get('lastRead' + topic + 'LogIndex', (error, result) => {
                    if (error) {
                        logger.error(error);
                        throw error;
                    }

                    if(lastBlockNumber != 0) {
                        redisClient.set('lastRead' + topic + 'LogIndex', lastBlockNumber, redis.print);
                    }
                });

            });
        });
    });
}

const fulfillFiatTransferredRequest = () => {
    /**
     * Check FiatMoneyTransferredToBank in event logs, frequency: every 5 minutes
     */
    var logger = getLogger(loggerName);
    try {
        handleFulfillFiatTransferredRequest();
    } catch (err) {
        logger.error("getFulfillFiatTransferredRequest");
        logger.error(err);
    }
}

export {
    fulfillFiatTransferredRequest
};