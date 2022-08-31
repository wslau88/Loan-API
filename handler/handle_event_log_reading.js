import redis from 'redis';
import Web3 from 'web3';
import pkg from 'pg';
import log4js from 'log4js';
import CollateralizedLoanGateway from '../contracts/CollateralizedLoanGateway.json';
import TruffleContract from '@truffle/contract';
import { queryDB } from '../util/db_call.js';
import {
    createInitiatedLoanQuery,
    updateLoanRequestedQuery,
    updateLoanCancelledQuery,
    updateLoanDisbursedQuery,
    updateLoanRepaidQuery,
    updateLoanDefaultedQuery,
    updateLoanFullyRepaidQuery
} from '../util/sql_query.js';

const loggerName = 'event_log_reading';
const redisPort = getEnvVar('REDIS_PORT');
const redisHost = getEnvVar('REDIS_HOST');

const handleInsertOrUpdateLoan = (caller, topic, eventKeys, query) => {
    var logger = getLogger(loggerName);

    const redisClient = redis.createClient(redisPort, redisHost);

    let web3 = new Web3();
    let collateralizedLoanGateway = TruffleContract(CollateralizedLoanGateway);
    collateralizedLoanGateway.setProvider(new web3.providers.HttpProvider("http://localhost:7545"));
    
    let logStart = 0;
    const logEnd = 'latest';
    
    logger.info(`Start running event log reading on topic ${topic}...`);

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
                
                let insertNewInitiatedLoan = async function(event){
                    let loanIdFromEvent = event.returnValues['_loanId'];
                    let lenderAddress = event.returnValues['_lender'];
                    let initiatedTime = event.returnValues['_initiatedTime'];

                    if(loanIdFromEvent) {
                        instance.methods['getLoanDetails(uint256)'].call(loanIdFromEvent, {from: lenderAddress}, function (err, loanItem) {
                            if(!err) {
                                let loanId = loanItem['loanId'];
                                let loanAmount = loanItem['loanAmount'];
                                let collateralAmount = web3.utils.fromWei(loanItem['collateralAmount'].toString(), "ether");
                                let lender = loanItem['lender'];
                                let loanStatus = loanItem['loanStatus'];
                                let loanTerm = loanItem['loanTerm'];
                                let apr = (parseInt(loanItem['apr']) / 10).toString();
                                let repaymentSchedule = loanItem['repaymentSchedule'];
                                let monthlyRepaymentAmount = loanItem['monthlyRepaymentAmount'];
                                let remainingRepaymentCount = loanItem['remainingRepaymentCount'];
                                let initialLTV = loanItem['initialLTV'];
                                let marginLTV = loanItem['marginLTV'];
                                let liquidationLTV = loanItem['liquidationLTV'];
                                let createTime = loanItem['createTime'];
                                let lastUpdateTime = loanItem['lastUpdateTime'];

                                let sqlParams = [
                                    loanId, loanAmount, collateralAmount, lender
                                    , loanStatus, loanTerm, apr, repaymentSchedule
                                    , monthlyRepaymentAmount, remainingRepaymentCount
                                    , initialLTV, marginLTV, liquidationLTV
                                    , createTime, lastUpdateTime
                                ];

                                if(parseInt(loanId) !== 0) {
                                    if(!err) {
                                        queryDB(query, sqlParams)
                                        .then(data => {
                                            logger.debug(data.rows)
        
                                            logger.info(`${topic} at block ${event.blockNumber}: Successfully executed for loanId ${loanId}`);
                                            // res.status(200).send(data.rows);
                                        })
                                        .catch(err => {
                                            logger.debug(err)
                                            // res.status(500).json({"error": "internal server error"});
            
                                            logger.error(`${topic} at block ${event.blockNumber}: Failed to execute for loanId ${loanId}`);
                                        })
                                    } else {
                                        logger.debug(err);
                                        logger.error(`${topic} at block ${event.blockNumber}: Error occurred on the side of CollateralizedLoanGateway for loanId ${loanId}`);
                                    }
                                }

                            } else {
                                logger.debug(err);
                                logger.error(`${topic} at block ${event.blockNumber}: Error occurred on the side of CollateralizedLoanGateway for loanId ${loanId}`);
                            }
                        });
                    }
                
                    logCount++;
                    lastBlockNumber = event.blockNumber;
                    logger.debug('logCount: ' + logCount);
                }

                let updateLoanDetails = async function(event){
                    let sqlParams = [];

                    let loanId = null;
                    for(var i = 0; i < eventKeys.length; i++) {
                        sqlParams.push(event.returnValues[eventKeys[i]]);
                        if(eventKeys[i] === "_loanId") loanId = event.returnValues[eventKeys[i]];
                    }

                    if(loanId && parseInt(loanId) !== 0) {
                        if(!err) {
                            queryDB(query, sqlParams)
                            .then(data => {
                                logger.debug(data.rows)

                                logger.info(`${topic} at block ${event.blockNumber}: Successfully executed for loanId ${loanId}`);
                                // res.status(200).send(data.rows);
                            })
                            .catch(err => {
                                logger.debug(err)
                                // res.status(500).json({"error": "internal server error"});

                                logger.error(`${topic} at block ${event.blockNumber}: Failed to execute for loanId ${loanId}`);
                            })
                        } else {
                            logger.debug(err);
                            logger.error(`${topic} at block ${event.blockNumber}: Error occurred on the side of CollateralizedLoanGateway`);
                        }
                    }
                
                    logCount++;
                    lastBlockNumber = event.blockNumber;
                    logger.debug('logCount: ' + logCount);
                }
                
                // Update the account balance with 0.1 second interval delay
                let main = async () => {
                    var i = 0;
                    while (i < eventArr.length) {
                        await Promise.all([
                            topic === "LoanInitiated"
                            ? insertNewInitiatedLoan(eventArr[i])
                            : updateLoanDetails(eventArr[i])
                        ]);

                        i++;
                    }
                }

                // Execute the main function
                main();
    
                // Record down the last read log/block index
                redisClient.get(`lastRead${topic}LogIndex`, (error, result) => {
                    if (error) {
                        logger.error(error);
                        throw error;
                    }

                    if(lastBlockNumber != 0) {
                        redisClient.set(`lastRead${topic}LogIndex`, lastBlockNumber, redis.print);
                        logger.debug(`Update lastRead${topic}LogIndex to ${lastBlockNumber}`);
                    }
                });
    
                // // Write the resolved requests as response body and return back to client
                // res.send(eventArr);

            });
        });
    });

    logger.info(`End running event log reading on topic ${topic}...`);
}

const handleGetLoanInitiated = () => {
    let caller = "handleGetLoanInitiated";
    let topic = "LoanInitiated";
    let eventKeys = ["_initiatedTime", "_loanId", "_lender"];
    let query = createInitiatedLoanQuery;

    handleInsertOrUpdateLoan(caller, topic, eventKeys, query);
}

const handleGetLoanRequested = () => {
    let caller = "handleGetLoanRequested";
    let topic = "LoanRequested";
    let eventKeys = ["_requester", "_requestedTime", "_loanId"];
    let query = updateLoanRequestedQuery;

    handleInsertOrUpdateLoan(caller, topic, eventKeys, query);
}

const handleGetLoanCancelled = () => {
    let caller = "handleGetLoanCancelled";
    let topic = "LoanCancelled";
    let eventKeys = ["_cancelTime", "_loanId", "_lender"];
    let query = updateLoanCancelledQuery;

    handleInsertOrUpdateLoan(caller, topic, eventKeys, query);
}

const handleGetLoanDisbursed = () => {
    let caller = "handleGetLoanDisbursed";
    let topic = "LoanDisbursed";
    let eventKeys = ["_nextRepaymentDeadline", "_disburseTime", "_loanId", "_lender"];
    let query = updateLoanDisbursedQuery;

    handleInsertOrUpdateLoan(caller, topic, eventKeys, query);
}

const handleGetLoanRepaid = () => {
    let caller = "handleGetLoanRepaid";
    let topic = "LoanRepaid";
    let eventKeys = ["_repaidTime", "_loanId", "_borrower"];
    let query = updateLoanRepaidQuery;

    handleInsertOrUpdateLoan(caller, topic, eventKeys, query);
}

const handleGetLoanDefaulted = () => {
    let caller = "handleGetLoanDefaulted";
    let topic = "LoanDefaulted";
    let eventKeys = ["_checkTime", "_loanId", "_borrower"];
    let query = updateLoanDefaultedQuery;

    handleInsertOrUpdateLoan(caller, topic, eventKeys, query);
}

const handleGetLoanFullyRepaid = () => {
    let caller = "handleGetLoanFullyRepaid";
    let topic = "LoanFullyRepaid";
    let eventKeys = ["_repaidTime", "_loanId", "_borrower"];
    let query = updateLoanFullyRepaidQuery;

    handleInsertOrUpdateLoan(caller, topic, eventKeys, query);
}

export {
    handleGetLoanInitiated,
    handleGetLoanRequested,
    handleGetLoanCancelled,
    handleGetLoanDisbursed,
    handleGetLoanRepaid,
    handleGetLoanDefaulted,
    handleGetLoanFullyRepaid,
};