
const https = require('https');
const fs = require('fs');

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDM0NTB9.WuPhoQoJFkOjPLs4dTVrk6BLG4eO_BdkPT0Wq0pUGKI";
const HOST = "rv8ynnb5.us-east.insforge.app";
const LOG_FILE = 'debug_output.txt';

function log(message) {
    fs.appendFileSync(LOG_FILE, message + '\n');
}

fs.writeFileSync(LOG_FILE, "Starting tests...\n");

function testFunction(name, payload = {}) {
    log(`\nTesting ${name}...`);
    const data = JSON.stringify(payload);

    const options = {
        hostname: HOST,
        port: 443,
        path: `/functions/${name}`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        log(`Status: ${res.statusCode} ${res.statusMessage}`);

        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            try {
                log("Body: " + JSON.stringify(JSON.parse(body), null, 2));
            } catch {
                log("Body: " + body);
            }
        });
    });

    req.on('error', (e) => {
        log(`Problem with request: ${e.message}`);
    });

    req.write(data);
    req.end();
}

// Test 1: test-create
testFunction('test-create', {});

// Test 2: create-token
setTimeout(() => {
    testFunction('create-token', {
        name: "Neon Debug",
        symbol: "DEBUG",
        image: "https://example.com/image.png"
    });
}, 2000);
