import getLogger from './logger.js';
import pgPackage from 'pg';

const { Client } = pgPackage;

const loggerName = 'default';

const queryDB = async (sql, params) => {
    const client = new Client({
        user: process.env.POSTGRES_DATABASE_USERNAME,
        host: process.env.POSTGRES_DATABASE_HOST,
        database: process.env.POSTGRES_DATABASE_DATABASENAME,
        password: process.env.POSTGRES_DATABASE_PWD,
        port: process.env.POSTGRES_DATABASE_PORT,
        ssl: {
            rejectUnauthorized: false
        }
    });

    client.connect()
    .catch(err => {
        var logger = getLogger(loggerName);
        logger.error(err);
    });

    let result = await client.query(sql, params)
    .then(data => {return data.rows})
    .catch(err => {throw err;});

    client.end();

    return result;
}

export {
    queryDB
};