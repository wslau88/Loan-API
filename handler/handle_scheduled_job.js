import log4js from 'log4js';
import pkg from 'pg';
import Web3 from 'web3';
import CollateralizedLoanGateway from '../contracts/CollateralizedLoanGateway.json';
import TruffleContract from '@truffle/contract';
import ReconnectingWebSocket from 'reconnecting-websocket';
import WS from 'ws';

log4js.configure({
    appenders: { scheduled_job: { type: 'dateFile', pattern: 'yyyy-MM-dd', filename: `../logs/scheduled_job/scheduled_job.log` } },
    categories: { default: { appenders: ['scheduled_job'], level: 'debug' } }
});
var logger = log4js.getLogger();
logger.level = 'debug';

const admin = "0x115d602cbbD68104899a81d29d6B5b9B5d3347b7";

var streamEthPrice = null;

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
        console.log("Connection Established ...");
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

const { Client } = pkg;
const client = new Client({
    user: process.env.POSTGRES_DATABASE_USERNAME,
    host: process.env.POSTGRES_DATABASE_HOST,
    database: process.env.POSTGRES_DATABASE_DATABASENAME,
    password: process.env.POSTGRES_DATABASE_PWD,
    port: process.env.POSTGRES_DATABASE_PORT,
    ssl: {
        rejectUnauthorized: false
    }
})
client.connect()

let getLoanLiquidationQuery = {
    text: ' \
        SELECT cl.LOAN_ID FROM COLLATERALIZED_LOAN cl \
        INNER JOIN \
        COLLATERALIZED_LOAN_STATUS cls \
        ON cl.LOAN_STATUS_CODE = cls.LOAN_STATUS_CODE \
        WHERE cls.LOAN_STATUS_DESC = \'LoanRepaying\' \
        AND cl.LOAN_AMOUNT / (cl.COLLATERAL_AMOUNT * $1) >= (CAST(cl.LIQUIDATION_LTV AS FLOAT) / 100)\
    ',
}

const handleCheckLoanLiquidation = async (req, res) => {
    const getLoanLiquidationIds = async () => {
        let loanLiquidationIds = [];
        if(streamEthPrice) {
            let values = [streamEthPrice];

            let data = await client.query(getLoanLiquidationQuery, values);
            loanLiquidationIds = data.rows.map((obj) => obj['loan_id']);
        }
        return loanLiquidationIds;
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
                // loanLiquidationIds.forEach((loanId) => {
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
                // });

                logger.debug(_collateralInUSD);
                logger.debug(_collateralPayables);

                instance.liquidateLoan(loanLiquidationIds, _collateralInUSD, _collateralPayables, {from: admin}).then((response, err) => {
                    if(!err){
                        logger.debug('checkLoanLiquidation completed');
                        logger.debug(response);
                        // res.status(200).send('OK');
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

const handleCheckDefaultedLoan = (req, res) => {
    var today = new Date();
    let todayDeadline = today.setHours(23,59,59,999);
    let checkTimestamp = Math.floor(todayDeadline / 1000);

    let web3 = new Web3();
    var collateralizedLoanGateway = TruffleContract(CollateralizedLoanGateway);
    collateralizedLoanGateway.setProvider(new web3.providers.HttpProvider("http://localhost:7545"));

    logger.info('\n-------------------------checkBorrowerDefault Start.-----------------------\n');

    collateralizedLoanGateway.deployed().then((instance) => {
        instance.checkBorrowerDefault(checkTimestamp, {from: admin}).then((response, err) => {
            if(!err){
                logger.debug('checkBorrowerDefault completed');
                logger.debug(response);
                // res.status(200).send('OK');
            } else {
                logger.error('checkBorrowerDefault error found');
                logger.error(err);
            }
            logger.info('\n-------------------------checkBorrowerDefault End.-------------------------\n');
        });
    });
}

export {
    handleCheckLoanLiquidation,
    handleCheckDefaultedLoan,
};