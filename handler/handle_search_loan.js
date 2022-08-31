import getLogger from '../util/logger.js';
import { queryDB } from '../util/db_call.js';
import {
    getInitiatedLoansByDefaultQuery,
    getLoanDetailsQuery,
    getInitiatedLoansByFilterQuery
} from '../util/sql_query.js';

const loggerName = 'search_loan';

const handleGetInitiatedLoansByDefault = (req, res) => {
    var logger = getLogger(loggerName);
    let userAddress = req.headers['user-address'];
    let params = [userAddress];

    queryDB(getInitiatedLoansByDefaultQuery, params)
    .then(data => {
        console.log(data);
        if(data && data.length > 0) {
            res.status(200).send(data[0]);
        } else {
            res.status(200).json([]);
        }
    })
    .catch(err => {
        console.log(err);
        logger.error(err);
        res.status(500).json({"error": "internal server error"});
    })
}

const isNumeric = (str) => {
    if (typeof str != "string") return false;
    return !isNaN(str) && !isNaN(parseFloat(str));
}

const mapRangeFilterValueToSQL = (rangeFilterValue) => {
    switch(rangeFilterValue) {
        case "LESS_THAN": return "<"
        case "LESS_THAN_OR_EQUAL_TO": return "<="
        case "EQAUL_TO": return "="
        case "GREATER_THAN": return ">"
        case "GREATER_THAN_OR_EQAUL_TO": return ">="
        case "NOT_EQUAL_TO": return "<>"
        case "BETWEEN": return "<=>"
        default: return ""
    }
}

const handleGetInitiatedLoansByFilter = (req, res) => {
    var logger = getLogger(loggerName);

    let collateralAmountFrom = req.query.collateralAmountFrom;
    let collateralAmountTo = req.query.collateralAmountTo;
    let collateralAmountRangeFilterValue = mapRangeFilterValueToSQL(req.query.collateralAmountRangeFilterValue);

    let borrowAmountFrom = req.query.borrowAmountFrom;
    let borrowAmountTo = req.query.borrowAmountTo;
    let borrowAmountRangeFilterValue = mapRangeFilterValueToSQL(req.query.borrowAmountRangeFilterValue);

    let aprFrom = req.query.aprFrom;
    let aprTo = req.query.aprTo;
    let aprRangeFilterValue = mapRangeFilterValueToSQL(req.query.aprRangeFilterValue);

    let loanTerm = req.query.loanTerm;

    let filterSql = "";
    if(collateralAmountRangeFilterValue === "<=>") {
        if(collateralAmountFrom && collateralAmountTo && isNumeric(collateralAmountFrom) && isNumeric(collateralAmountTo)) {
            filterSql += ` AND COLLATERAL_AMOUNT BETWEEN ${collateralAmountFrom} AND ${collateralAmountTo}`;
        }
    } else {
        if(collateralAmountFrom && isNumeric(collateralAmountFrom)) {
            filterSql += ` AND COLLATERAL_AMOUNT ${collateralAmountRangeFilterValue} ${collateralAmountFrom}`;
        }
    }

    if(borrowAmountRangeFilterValue === "<=>") {
        if(borrowAmountFrom && borrowAmountTo && isNumeric(borrowAmountFrom) && isNumeric(borrowAmountTo)) {
            filterSql += ` AND LOAN_AMOUNT BETWEEN ${borrowAmountFrom} AND ${borrowAmountTo}`;
        }
    } else {
        if(borrowAmountFrom && isNumeric(borrowAmountFrom)) {
            filterSql += ` AND LOAN_AMOUNT ${borrowAmountRangeFilterValue} ${borrowAmountFrom}`;
        }
    }

    if(aprRangeFilterValue === "<=>") {
        if(aprFrom && aprTo && isNumeric(aprFrom) && isNumeric(aprTo)) {
            filterSql += ` AND APR BETWEEN ${aprFrom} AND ${aprTo}`;
        }
    } else {
        if(aprFrom && isNumeric(aprFrom)) {
            filterSql += ` AND APR ${aprRangeFilterValue} ${aprFrom}`;
        }
    }

    if(loanTerm && isNumeric(loanTerm)) {
        filterSql += ` AND LOAN_TERM = ${loanTerm}`;
    }

    let userAddress = req.headers['user-address'];
    let params = [userAddress];

    if(filterSql !== "") {
        let formattedQuery = getInitiatedLoansByFilterQuery.replace("$$PARAM_SQL$$", filterSql);

        queryDB(formattedQuery, params)
        .then(data => {
            console.log(data);
            if(data && data.length > 0) {
                res.status(200).send(data[0]);
            } else {
                res.status(200).json([]);
            }
        })
        .catch(err => {
            console.log(err);
            logger.error(err);
            res.status(500).json({"error": "internal server error"});
        })
    } else {
        queryDB(getInitiatedLoansByDefaultQuery, params)
        .then(data => {
            console.log(data);
            if(data && data.length > 0) {
                res.status(200).send(data[0]);
            } else {
                res.status(200).json([]);
            }
        })
        .catch(err => {
            console.log(err);
            logger.error(err);
            res.status(500).json({"error": "internal server error"});
        })
    }
}

const handleGetLoanDetails = async (req, res) => {
    var logger = getLogger(loggerName);

    let loanId = req.params['loanId'];
    let userAddress = req.headers['user-address'];
    let params = [loanId, userAddress];

    queryDB(getLoanDetailsQuery, params)
    .then(data => {
        // console.log(data);
        if(data && data.length > 0) {
            res.status(200).send(data[0]);
        } else {
            res.status(200).json([]);
        }
    })
    .catch(err => {
        // console.log(err);
        logger.error(err);
        res.status(500).json({"error": "internal server error"});
    })
}


export {
    handleGetInitiatedLoansByDefault,
    handleGetInitiatedLoansByFilter,
    handleGetLoanDetails,
};