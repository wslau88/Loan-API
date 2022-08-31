import pkg from 'pg';
import Web3 from 'web3';
import CollateralizedLoanGateway from '../contracts/CollateralizedLoanGateway.json';
import TruffleContract from '@truffle/contract';
import ReconnectingWebSocket from 'reconnecting-websocket';
import WS from 'ws';
import getLogger from '../util/logger.js';
import { queryDB } from '../util/db_call.js';
import { getLoanLiquidationQuery } from '../util/sql_query.js';

var streamEthPrice = null;

const loggerName = 'check_liquidated_loan';
const admin = getEnvVar('ADMIN_WALLET_ADDRESS');

const initiateWebsocket = async () => {
    const wsOptions = {
        WebSocket: WS,
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 1000,
        connectionTimeout: 5000,
        minUptime: 5000,
        maxRetries: 10,
        reconnectionDelayGrowFactor: 1.3,
        debug: false
    }
    const url = "wss://cnode.dynamicstrategies.io:9010";
    const ws = new ReconnectingWebSocket(url, [], wsOptions);

    ws.addEventListener('open', () => {
        // console.log("Connection Established ...");
    });

    ws.addEventListener('message', (e) => {
        let dataFromServer = JSON.parse(e.data);
        if (dataFromServer.type === 'ethspot') {
            streamEthPrice = dataFromServer.values.index;
        }
    });

    ws.addEventListener('error', (e) => {
        console.log('error: ', e.data);
    });

    ws.addEventListener('close', (e) => {
        if(e.data)
            console.log('error: ', e.data);
    });

    return ws;
}

const handleCheckLoanLiquidation = async () => {
    var logger = getLogger(loggerName);
    
    const getLoanLiquidationIds = async () => {
        let loanLiquidationIds = [];
        if(streamEthPrice) {
            let params = [streamEthPrice];

            return queryDB(getLoanLiquidationQuery, params)
            .then(data => {
                loanLiquidationIds = data.rows.map((obj) => obj['loan_id']);
                return loanLiquidationIds;
            })
            .catch(err => {
                logger.error('handleCheckLoanLiquidation error found');
                logger.error(err);
                return [];
            })
            
        }
    }

    let web3 = new Web3();
    var collateralizedLoanGateway = TruffleContract(CollateralizedLoanGateway);
    collateralizedLoanGateway.setProvider(new web3.providers.HttpProvider("http://localhost:7545"));

    logger.info('\n-------------------------checkLoanLiquidation Start.-----------------------\n');
    
    const wsClient = await initiateWebsocket();
    setTimeout(async () => {
        wsClient.close();
        logger.debug("streamEthPrice: " + streamEthPrice);
        // logger.info("streamEthPrice: " + streamEthPrice);
        let loanLiquidationIds = await getLoanLiquidationIds();
        logger.debug('loanLiquidationIds: ' + loanLiquidationIds);

        if(loanLiquidationIds.length > 0) {
            collateralizedLoanGateway.deployed().then(async (instance) => {
                let _collateralInUSD = [];
                let _collateralPayables = [];

                for(var k = 0; k < loanLiquidationIds.length; k++) {
                    loanId = loanLiquidationIds[k];
                    let loanItem = await instance.methods['getLoanDetails(uint256)'].call(loanId, {from: admin});
                    let collateralAmountInUSD = Math.floor(web3.utils.fromWei((loanItem['collateralAmount']).toString(), "ether") * streamEthPrice);
                    let collateralPayable = web3.utils.toWei(
                        ((collateralAmountInUSD - parseInt(loanItem['loanAmount'])) / streamEthPrice).toString()
                        ,  "ether");
                    _collateralInUSD.push(collateralAmountInUSD);
                    _collateralPayables.push(collateralPayable);
                }

                logger.debug(_collateralInUSD);
                logger.debug(_collateralPayables);

                instance.liquidateLoan(loanLiquidationIds, _collateralInUSD, _collateralPayables, {from: admin}).then((response, err) => {
                    if(!err){
                        logger.debug('checkLoanLiquidation completed');
                        logger.debug(response);
                    } else {
                        logger.error('checkLoanLiquidation error found');
                        logger.error(err);
                    }
                });

                // instance.methods['liquidateLoan(uint256[],uint256[],uint256[])'].call(loanLiquidationIds, _collateralInUSD, _collateralPayables, {from: admin}, function (err, res) {
                //     if(!err){
                //         logger.debug(res);
                //     } else {
                //         logger.debug(err);
                //     }
                //     logger.info('\n-------------------------checkLoanLiquidation End.-------------------------\n');
                // });
            });
        }

        logger.info('\n-------------------------checkLoanLiquidation End.-------------------------\n');
    }, 3000);
}

const checkLoanLiquidation = async () => {
    /**
     * Check loan that reaches liquidation LTV, frequency: every 15 seconds
     */
    var logger = getLogger(loggerName);
    try {
        await handleCheckLoanLiquidation();
    } catch (err) {
        logger.error("checkLoanLiquidation");
        logger.error(err);
    }
}

export {
    checkLoanLiquidation
};