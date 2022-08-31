import express from 'express';
import cors from 'cors';
import moment from 'moment';
import bank_transfer from './bank_transfer.js';
import search_loan from './search_loan.js';

const app = express();

const allowedOrigins = ['http://localhost:3000'];
const port = 8082;

app.use(cors({
    origin: function(origin, callback){
      // allow requests with no origin 
      // (like mobile apps or curl requests)
      if(!origin) return callback(null, true);
      if(allowedOrigins.indexOf(origin) === -1){
        var msg = 'The CORS policy for this site does not ' +
                  'allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    }
}));

app.use('/bankTransfer', bank_transfer);
app.use('/searchLoan', search_loan);

app.use((err, req, res, next) => {
  res.status(err.status || 400).json({
    success: false,
    message: err.message || 'An error occured.',
    errors: err.error || [],
    time: moment().format('yyyy-MM-DDTHH:mm:ssZ')
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found.',
    time: moment().format('yyyy-MM-DDTHH:mm:ssZ')
  });
});

// Start the server
app.listen(port);

console.log(`Server started on ${port}...`);
