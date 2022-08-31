/**
 * Airnode program for handling off-chain data requests
 * Listen on port 9090
 * Current endpoint:
 * - GET /fulfillFiatTransferredRequest:
 *      1. Fulfill the transfer request of fiat money from loan platform to Bank savins account through Open API
 *      2. Update the balance in Transactions contract
 * - POST /postLogin
 *      1. Get JWT from Open API
 *      2. Store the JWT in Redis and retrieve by user address as key
 * - GET /getAccountInfo/:userAddress
 *      1. Get bank account info through Open API
 * - POST /transferFiatToDEX
 *      1. Deduce account balance through Open API
 *      2. Update the balance in Transactions contract
 */

import express from 'express';
import {
    handlePostLogin,
    handleGetUserAccountInfo,
    handlePostTransferFiatToDEX,
} from '../handler/handle_bank_transfer.js';

const loggerName = 'bank_transfer';

var app = express()
app.use(express.json({
    type: "*/*" // optional, only if you want to be sure that everything is parsed as JSON. Wouldn't recommend
}));

/**
 * Login to Open API and get a JWT as user token with lifetime of 30 minutes
 */
app.post('/postLogin', function (req, res) {
    var logger = getLogger(loggerName);
    try {
        handlePostLogin(req, res);
    } catch (err) {
        logger.error("POST /postLogin: " + err);
    }
})

/**
 * Get bank account info of a user
 */
app.get('/getAccountInfo/:userAddress', function (req, res) {
    var logger = getLogger(loggerName);
    try {
        handleGetUserAccountInfo(req, res);
    } catch (err) {
        logger.error("GET /getAccountInfo/:userAddress: " + err);
    }
})

/**
 * Transfer fiat money from bank account to DEX
 */
app.post('/transferFiatToDEX', function (req, res) {
    var logger = getLogger(loggerName);
    try {
        handlePostTransferFiatToDEX(req, res);
    } catch (err) {
        logger.error("POST /transferFiatToDEX: " + err);
    }
})

export default app;