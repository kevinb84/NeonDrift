
const https = require('https');

const HOST = "public-api-v2.bags.fm";

function probe(method, path) {
    return new Promise((resolve) => {
        const options = {
            hostname: HOST,
            port: 443,
            path: path,
            method: method,
            headers: {
                'x-api-key': 'dummy_key',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            console.log(`${method} ${path} -> ${res.statusCode} ${res.statusMessage}`);
            resolve();
        });

        req.on('error', (e) => {
            console.log(`${method} ${path} -> ERROR: ${e.message}`);
            resolve();
        });

        req.end();
    });
}

async function runProbes() {
    console.log("Starting probes...");
    // Config Probes
    await probe('POST', '/api/v1/token-launch/create-config');
    await probe('GET', '/api/v1/token-launch/config');

    // Trade Probes
    await probe('GET', '/api/v1/trade/status');
    await probe('POST', '/api/v1/trade/parse-tx');
    await probe('POST', '/api/v1/swap');

    // Known Good
    await probe('POST', '/api/v1/token-launch/create-token-info');

    // Try to guess create-launch-tx
    await probe('POST', '/api/v1/token-launch/create-launch-transaction');
    await probe('POST', '/api/v1/token-launch/create-token-launch-transaction');
}

runProbes();
