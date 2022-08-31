/**
 * Import Logging library
 */
import log4js from 'log4js';

const logLocation = "./logs";
const logConfig = {
    appenders: {
        default: {
            type: 'dateFile',
            pattern: 'yyyy-MM-dd',
            filename: `${logLocation}/app.log`
        },
        bank_transfer: {
            type: 'dateFile',
            pattern: 'yyyy-MM-dd',
            filename: `${logLocation}/bank_transfer/bank_transfer.log`
        },
        search_loan: {
            type: 'dateFile',
            pattern: 'yyyy-MM-dd',
            filename: `${logLocation}/search_loan/search_loan.log`
        },
        check_bank_transfer: {
            type: 'dateFile',
            pattern: 'yyyy-MM-dd',
            filename: `${logLocation}/scheduled_job/check_bank_transfer.log`
        },
        update_admin_token: {
            type: 'dateFile',
            pattern: 'yyyy-MM-dd',
            filename: `${logLocation}/scheduled_job/update_admin_token.log`
        },
        check_liquidated_loan: {
            type: 'dateFile',
            pattern: 'yyyy-MM-dd',
            filename: `${logLocation}/scheduled_job/check_liquidated_loan.log`
        },
        check_defaulted_loan: {
            type: 'dateFile',
            pattern: 'yyyy-MM-dd',
            filename: `${logLocation}/scheduled_job/check_defaulted_loan.log`
        },
        event_log_reading: {
            type: 'dateFile',
            pattern: 'yyyy-MM-dd',
            filename: `${logLocation}/scheduled_job/event_log_reading.log`
        }
    },
    categories: {
        default: {
            appenders: ['default'],
            level: 'error'
        },
        bank_transfer: {
            appenders: ['bank_transfer'],
            level: 'debug'
        },
        search_loan: {
            appenders: ['search_loan'],
            level: 'debug'
        },
        check_bank_transfer: {
            appenders: ['check_bank_transfer'],
            level: 'info'
        },
        update_admin_token: {
            appenders: ['update_admin_token'],
            level: 'info'
        },
        check_liquidated_loan: {
            appenders: ['check_liquidated_loan'],
            level: 'info'
        },
        check_defaulted_loan: {
            appenders: ['check_defaulted_loan'],
            level: 'info'
        },
        event_log_reading: {
            appenders: ['event_log_reading'],
            level: 'info'
        }
    }
};

const getLogger = (loggerName) => {
    log4js.configure(logConfig);
    return log4js.getLogger(loggerName);
}

export default getLogger;
