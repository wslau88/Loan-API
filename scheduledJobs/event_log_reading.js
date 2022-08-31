import {
    handleGetLoanInitiated,
    handleGetLoanRequested,
    handleGetLoanCancelled,
    handleGetLoanDisbursed,
    handleGetLoanRepaid,
    handleGetLoanDefaulted,
    handleGetLoanFullyRepaid,
} from '../handler/handle_event_log_reading.js';
import getLogger from '../util/logger.js';

const loggerName = 'event_log_reading';

const eventLogReading = () => {
    var logger = getLogger(loggerName);
    try {
        handleGetLoanInitiated();
        handleGetLoanRequested();
        handleGetLoanCancelled();
        handleGetLoanDisbursed();
        handleGetLoanRepaid();
        handleGetLoanDefaulted();
        handleGetLoanFullyRepaid();
    } catch (err) {
        logger.error("event_log_reading: " + err);
    }
}

export {
    eventLogReading
};
