import fs from 'fs';
import fetch from 'node-fetch';

import { mongoDb, sqlPool } from './db.js';
import * as env from './env.js';
import { args, log } from './util.js';

const SYNCHRONIZED_BICYCLE_FILE = 'data/ok.json';
const FAILED_BICYCLE_FILE = 'data/err.json';

/**
 * @returns the query body excluding SELECT, ORDER BY, and OFFSET clauses.
 */
function createQueryBody(startYear = 0, endYear = 0) {
    const startYearFilter = startYear > 0 ? `b.year_id >= ${startYear} and` : '';
    const endYearFilter = endYear > 0 ? `b.year_id <= ${endYear} and` : '';
    return `
        from bicycle b
        left join bicycle_brand bb on b.brand_id = bb.id
        left join bicycle_model bm on b.model_id = bm.id
        left join bicycle_type bt on b.type_id = bt.id
        where
            b.is_delete = 0 and
            bb.is_delete = 0 and
            bm.is_delete = 0 and
            bt.is_delete = 0 and
            b.retail_price is not null and
            b.retail_price > 0.0001 and
            ${startYearFilter}
            ${endYearFilter}
            1 = 1
    `;
}

/**
 * Returns the promises for bicycle retrievals paginatedly.
 * @param {String} queryBody the conditions for filtering.
 * @param {Number} total the number of bicycles need to be fetched.
 */
async function prepareFetchingAllBicycles(queryBody = '', total = 0) {
    const maxConnections = 30;
    const pageSize = 50;
    const fetchers = [];
    const pools = [];
    let pool = await sqlPool(maxConnections);
    for (let page = 0; page <= total / pageSize; page++) {
        let currentPool = pool;
        if (page % maxConnections === 0) {
            currentPool = await sqlPool();
            pool = currentPool;
            pools.push(pool);
        }
        const offset = page * pageSize;
        fetchers.push(currentPool.query(`
            select
                b.id as id,
                b.name as name,
                bb.id as brand_id,
                bb.name as brand,
                bm.id as model_id,
                bm.name as model,
                b.year_id as year,
                b.retail_price as msrp,
                bt.name as type
            ${queryBody}
            order by b.id desc
            offset ${offset} rows fetch next ${pageSize} rows only
        `));
    }
    const close = async () => {
        for (const p of pools) {
            await p.close();
        }
    };
    return {
        /**
         * Each fetcher could return a pagination set of bicycles.
         */
        fetchers,
        /**
         * Closes all connection pools that be used when fetching.
         */
        close,
    };
}

/**
 * Retrieves all active and not-deleted bicycles from BBB's SQL Server.
 */
async function fetchAllBicycles(fromYear = 0, toYear = 0) {
    const queryBody = createQueryBody(fromYear, toYear);
    log('counting records for years from', fromYear, 'to', toYear);

    const pool = await sqlPool();
    const count = (await pool.query(`
        select
            count(b.id) as total
        ${queryBody}
    `)).recordset[0];
    await pool.close();

    const total = Number(count['total']);
    log('fetching', total, 'records');

    const { fetchers, close } = await prepareFetchingAllBicycles(queryBody, total);
    try {
        const bicycles = (await Promise.all(fetchers))
            .flatMap((res) => res.recordset.map((rec) => ({
                id: Number(rec['id']),
                name: rec['name'],
                brandId: Number(rec['brand_id']),
                brand: rec['brand'],
                modelId: Number(rec['model_id']),
                model: rec['model'],
                year: rec['year'],
                msrp: Number(rec['msrp']),
                type: rec['type'],
            })));
        log(bicycles.length, 'records fetched');
        return bicycles;
    } finally {
        await close();
    }
}

/**
 * Does some comparisions between the bicycles fetched from BBB's SQL Server
 * and the ones in BBB's MongoDB to synchronize their information.
 */
async function synchronizeBicycles(bicycles = [{
    id: 0,
    name: '',
    brandId: 0,
    brand: '',
    modelId: 0,
    model: '',
    year: 0,
    msrp: 0,
    type: '',
}], excludes = []) {
    const { db, close } = await mongoDb();
    try {
        const comparators = [];
        const res = (data = { id: 0 }, ok = true) => ({
            /**
             * Bicycle's id.
             */
            id: data.id,
            /**
             * Bicycle's details.
             */
            data,
            /**
             * Indicates that the bicycle has been synchronized successfully or not.
             */
            ok,
        });
        for (const bicycle of bicycles) {
            comparators.push((async () => {
                if (excludes.includes(bicycle.id)) return res(bicycle);
                await db.collection('price_v2').deleteMany({
                    make: bicycle.brand,
                    model: bicycle.model,
                    year: bicycle.year,
                    // msrp: bicycle.msrp, // TODO: floating point searching issue
                    // type: bicycle.type,
                });
                const response = await fetch(`${env.BBB_ML_BASE_URL}/api/sync-bicycle-data?env=${env.ENV}&utm_source=${env.APP}`, {
                    method: 'POST',
                    body: JSON.stringify({
                        make: bicycle.brand,
                        model: bicycle.model,
                        model_bicycle_id: bicycle.modelId,
                        model_id: bicycle.modelId,
                        model_lower_case: bicycle.model.toLowerCase(),
                        msrp: bicycle.msrp,
                        title: bicycle.name,
                        type: bicycle.type,
                        year: bicycle.year,
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': `bicyclebluebook (project: ${env.APP}, environment: ${env.ENV})`,
                        [env.BBB_ML_SECRET_HEADER]: env.BBB_ML_SECRET_HEADER_VALUE,
                    },
                });
                if (response.status >= 400) {
                    log(bicycle.id, 'error', response.status, await response.text());
                    return res(bicycle, false);
                }
                return res(bicycle);
            })());
        }
        const all = await Promise.all(comparators);
        const ok = all.filter((e) => e.ok).map((e) => e.id);
        const err = all.filter((e) => !e.ok).map((e) => e.data);
        log(ok.length, 'succeeded');
        log(err.length, 'failed');
        fs.writeFileSync(SYNCHRONIZED_BICYCLE_FILE, JSON.stringify(ok));
        fs.writeFileSync(FAILED_BICYCLE_FILE, JSON.stringify(err));
    } finally {
        await close();
    }
}


fetchAllBicycles(
    Number(args()['from']),
    Number(args()['to']),
).then(async (bicycles) => {
    let synchronizedBicycleIds = [];
    try {
        synchronizedBicycleIds = JSON.parse(fs.readFileSync(SYNCHRONIZED_BICYCLE_FILE));
    } catch {}
    if (env.FORCE_SYNC) {
        log('FORCE_SYNC', 'enabled');
        synchronizedBicycleIds = [];
    }
    return synchronizeBicycles(bicycles, synchronizedBicycleIds);
}).catch(log);