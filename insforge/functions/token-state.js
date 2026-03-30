const BAGS_API_BASE = "https://public-api-v2.bags.fm/api/v1/assets"; // Placeholder

module.exports = async function (req) {
    // CORS Headers
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Handle both POST body and GET query params
        let tokenAddress;

        if (req.method === "POST") {
            const body = await req.json();
            tokenAddress = body.tokenAddress;
        } else {
            const url = new URL(req.url);
            tokenAddress = url.searchParams.get("token");
        }

        const apiKey = Deno.env.get("BAGS_API_KEY");

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Server misconfiguration: BAGS_API_KEY missing" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!tokenAddress) {
            throw new Error("Missing token address parameter");
        }

        // For now, since we don't have a direct "get token state" endpoint in the public docs, 
        // and /assets/{mint} seems to be failing, we will try to fetch from the token-launch info 
        // OR mock it if it fails, to unblock the UI.

        let data = {
            marketCap: 1000000,
            price: 0.001,
            supply: 1000000000,
            curveProgress: 0.1
        };

        try {
            // Attempt to fetch real data if possible, or leave as mock for now
            // const response = await fetch(`${BAGS_API_BASE}/token-launch/...?token=${tokenAddress}`, ...);
        } catch (e) {
            console.warn("Failed to fetch real state, using mock", e);
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        return new Response(JSON.stringify({
            message: error.message,
            error: error.message
        }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};
