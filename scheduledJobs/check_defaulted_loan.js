import Web3 from 'web3';
import CollateralizedLoanGateway from '../contracts/CollateralizedLoanGateway.json';
import TruffleContract from '@truffle/contract';
import getLogger from '../util/logger.js';

const loggerName = 'check_defaulted_loan';
const admin = getEnvVar('ADMIN_WALLET_ADDRESS');

const handleCheckDefaultedLoan = () => {
    var logger = getLogger(loggerName);
    
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
            } else {
                logger.error('checkBorrowerDefault error found');
                logger.error(err);
            }
            logger.info('\n-------------------------checkBorrowerDefault End.-------------------------\n');
        });
    });
}

const checkDefaultedLoan = () => {
    /**
     * Check loan that defaults, frequency: every EOD
     */
    var logger = getLogger(loggerName);
    try {
        handleCheckDefaultedLoan();
    } catch (err) {
        logger.error("checkDefaultedLoan");
        logger.error(err);
    }
}

export {
    checkDefaultedLoan
};
