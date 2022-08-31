import dotenv from 'dotenv';

dotenv.config();

const getEnvVar = (varName) => {
    return process.env[varName];
}

export default getEnvVar;