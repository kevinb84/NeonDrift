
const BAGS_API_URL = "https://public-api-v2.bags.fm/api/v1/assets/create";

async function testCreate() {
    console.log("Testing create-token...");
    try {
        const apiKey = Deno.env.get("BAGS_API_KEY");
        if (!apiKey) {
            console.error("BAGS_API_KEY missing");
            return;
        }

        const response = await fetch(BAGS_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify({
                name: "Neon Drift Test",
                symbol: "TEST",
                image: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
            }),
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Data:", JSON.stringify(data, null, 2));

    } catch (e) {
        console.error("Test Failed:", e);
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}

testCreate();
