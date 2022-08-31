import express from 'express';
import {
    handleGetInitiatedLoansByDefault
    , handleGetInitiatedLoansByFilter
    , handleGetLoanDetails
} from '../handler/handle_search_loan.js';
import getLogger from '../util/logger.js';

const loggerName = 'search_loan';

var app = express()
app.use(express.json({
    type: "*/*" // optional, only if you want to be sure that everything is parsed as JSON. Wouldn't recommend
}));

/**
 * Get initiated loans from DB, by default 100 rows
 */
app.get('/initiatedLoansByDefault', function(req, res) {
    var logger = getLogger(loggerName);
    try {
        handleGetInitiatedLoansByDefault(req, res);
    } catch (err) {
        logger.error("GET /initiatedLoansByDefault: " + err);
    }
})

/**
 * Get initiated loans from DB, by filter values with max 100 rows
 */
app.get('/initiatedLoansByFilter', function(req, res) {
    var logger = getLogger(loggerName);
    try {
        handleGetInitiatedLoansByFilter(req, res);
    } catch (err) {
        logger.error("GET /initiatedLoansByFilter: " + err);
    }
})

/**
 * Get loan details from DB by loanId
 */
app.get('/loanDetails/:loanId', function(req, res) {
    var logger = getLogger(loggerName);
    try {
        handleGetLoanDetails(req, res);
    } catch (err) {
        logger.error("GET /loanDetails/:loanId: " + err);
    }
})

export default app;
