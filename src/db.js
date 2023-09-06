import { MongoClient } from 'mongodb';
import mssql from 'mssql';

import * as env from './env.js';

export async function sqlPool(maxConnections = 20) {
    return new mssql.ConnectionPool({
        user: env.MSSQL_USER,
        password: env.MSSQL_PASSWORD,
        database: env.MSSQL_DATABASE,
        server: env.MSSQL_HOST,
        port: env.MSSQL_PORT,
        pool: {
            max: maxConnections,
            min: 1,
            idleTimeoutMillis: 300000,
            createTimeoutMillis: 300000,
            acquireTimeoutMillis: 300000,
        },
        options: {
            requestTimeout: 300000,
            encrypt: true,
            trustServerCertificate: true,
        },
    }).connect();
}

export async function mongoDb() {
    const url = `mongodb://${env.MONGO_USER}:${env.MONGO_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_DATABASE}`;
    const client = new MongoClient(url, {
        maxPoolSize: 20,
        minPoolSize: 1,
        maxIdleTimeMS: 30000,
    });
    return {
        db: (await client.connect()).db(env.MONGO_DATABASE),
        /**
         * Closes the opened connection.
         */
        close: () => client.close(),
    };
}