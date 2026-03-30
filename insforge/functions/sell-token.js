const BAGS_API_URL = "https://public-api-v2.bags.fm/api/v1/assets/sell"; // Placeholder

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
        const { tokenAddress, amount, sellerAddress, slippage } = await req.json();
        const apiKey = Deno.env.get("BAGS_API_KEY");

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Server misconfiguration: BAGS_API_KEY missing" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Call Bags API
        const response = await fetch(BAGS_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify({
                token: tokenAddress,
                amount: amount, // Amount of tokens to sell
                seller: sellerAddress,
                slippage: slippage || 0.5,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to get sell transaction from Bags");
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
