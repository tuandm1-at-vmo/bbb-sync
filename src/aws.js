import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import * as AWS from 'aws-sdk';

import * as env from './env.js';

export function openSearch() {
    return new Client({
        ...AwsSigv4Signer({
            region: env.AWS_DEFAULT_REGION,
            service: 'es',
            getCredentials: () => (
                new Promise((resolve, reject) => {
                    AWS.config.getCredentials((err, credentials) => {
                        if (err) reject(err);
                        else resolve(credentials);
                    });
                })
            ),
        }),
        auth: {
            username: env.AWS_ES_USER,
            password: env.AWS_ES_PASSWORD,
        },
        node: env.AWS_ES_URL,
    });
}