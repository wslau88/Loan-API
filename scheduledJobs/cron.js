import cron from 'node-cron';

import {fulfillFiatTransferredRequest} from './check_bank_transfer.js';
import {checkDefaultedLoan} from './check_defaulted_loan.js';
import {checkLoanLiquidation} from './check_liquidated_loan.js';
import {eventLogReading} from './event_log_reading.js';
import {adminLogin} from './update_admin_token.js';

//execute every 30 sec
cron.schedule('*/30 * * * * *', function(){
    console.log(`fulfillFiatTransferredRequest: Running every 30 sec at ${new Date()}`);
    fulfillFiatTransferredRequest();
});

//execute every 5 min
cron.schedule('*/5 * * * *', function(){
    console.log(`adminLogin: Running every 5 min at ${new Date()}`);
    adminLogin();
});

//execute every EOD
cron.schedule('59 59 23 * * *', function(){
    console.log(`checkDefaultedLoan: Running every EOD at ${new Date()}`);
    checkDefaultedLoan();
});

//execute every 5 min
cron.schedule('* */5 * * * *', function(){
    console.log(`checkLoanLiquidation: Running every 5 min at ${new Date()}`);
    checkLoanLiquidation();
});

//execute every 15 sec
cron.schedule('*/15 * * * * *', function(){
    console.log(`eventLogReading: Running every 15 sec at ${new Date()}`);
    eventLogReading();
});