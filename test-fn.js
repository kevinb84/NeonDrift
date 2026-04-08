const { createClient } = require('@insforge/sdk');

async function test() {
    const client = createClient('https://rv8ynnb5.us-east.insforge.app', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDM0NTB9.WuPhoQoJFkOjPLs4dTVrk6BLG4eO_BdkPT0Wq0pUGKI');
    
    const { data, error } = await client.functions.invoke('create-token', {
        body: {
            name: 'test',
            symbol: 'TEST',
            image: 'https://test.com/image.png',
            socials: {},
            creatorAddress: 'E1G64qjXW8JvmbLXXeL8u95ZgGgS3mH2ZndzE3j1bK1m',
            initialBuyLamports: 0
        }
    });

    console.log("Error directly:", error);
    if (error && error.context) {
        try {
            const body = await error.context.json();
            console.log("Error body JSON:", body);
        } catch {
            const text = await error.context.text();
            console.log("Error body text:", text);
        }
    }
}

test();
