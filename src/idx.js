import fs from 'fs';

import { openSearch } from './aws.js';
import { sqlPool } from './db.js';
import * as env from './env.js';
import { log } from './util.js';

const BULK_BODY_FILE = 'data/bulk.ndjson';
const START_YEAR = 2020;

async function countAllBicycles() {
    const pool = await sqlPool();
    try {
        const count = (await pool.query`
            select
                count(b.id) as total
            from bicycle b
            left join bicycle_brand bb on b.brand_id = bb.id
            left join bicycle_model bm on b.model_id = bm.id
            left join bicycle_type bt on b.type_id = bt.id
            left join bicycle_year y on b.year_id = y.id
            where
                b.is_delete = 0 and
                bb.is_delete = 0 and
                bm.is_delete = 0 and
                bt.is_delete = 0 and
                y.is_delete = 0 and
                b.active = 1 and
                b.year_id >= ${START_YEAR}
        `).recordset[0];
        return Number(count['total']);
    } finally {
        await pool.close();
    }
}

async function selectAllBicycles(total = 0) {
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
        fetchers.push(currentPool.query`
            select
                b.id as id,
                b.name as name,
                bb.id as brand_id,
                bb.name as brand,
                bm.id as model_id,
                bm.name as model,
                y.id as year_id,
                y.name as year,
                b.retail_price as msrp,
                bt.id as type_id,
                bt.name as type
            from bicycle b
            left join bicycle_brand bb on b.brand_id = bb.id
            left join bicycle_model bm on b.model_id = bm.id
            left join bicycle_type bt on b.type_id = bt.id
            left join bicycle_year y on b.year_id = y.id
            where
                b.is_delete = 0 and
                bb.is_delete = 0 and
                bm.is_delete = 0 and
                bt.is_delete = 0 and
                y.is_delete = 0 and
                b.active = 1 and
                b.year_id >= ${START_YEAR}
            order by b.id desc
            offset ${offset} rows fetch next ${pageSize} rows only
        `);
    }
    const close = async () => {
        for (const p of pools) {
            await p.close();
        }
    };
    return {
        fetchers,
        close,
    };
}

async function index() {
    const total = await countAllBicycles();
    const { fetchers, close } = await selectAllBicycles(total);
    try {
        log('total bicycles:', total);
        const bicycles = (await Promise.all(fetchers))
            .flatMap((res) => res.recordset.map((rec => ({
                id: Number(rec['id']),
                brandId: Number(rec['brand_id']),
                brandName: rec['brand'],
                modelId: Number(rec['model_id']),
                modelName: rec['model'],
                yearId: Number(rec['year_id']),
                yearName: Number(rec['year']),
                typeId: rec['type_id'],
                typeName: rec['type'],
                textSearch: rec['name'],
            }))));
        log('total fetched:', bicycles.length);
        const bulkBody = bicycles.flatMap((bicycle) => ([
            {
                index: {
                    '_index': env.AWS_ES_BICYCLE_INDEX,
                    '_id': bicycle.id,
                },
            },
            {
                ...bicycle,
            },
        ])).map((e) => JSON.stringify(e)).join('\n');
        fs.writeFileSync(BULK_BODY_FILE, bulkBody);
        const client = openSearch();
        await client.bulk({
            index: env.AWS_ES_BICYCLE_INDEX,
            body: bulkBody,
        });
    } finally {
        await close();
    }
}

log('env', env.ENV).then(index).catch(log);