
const BAGS_API_BASE = "https://public-api-v2.bags.fm/api/v1"; // Updated 2026-02-14 T16:58

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
        const { name, symbol, image, creatorAddress } = await req.json();
        const apiKey = Deno.env.get("BAGS_API_KEY");

        if (!apiKey) {
            throw new Error("Server misconfiguration: BAGS_API_KEY missing");
        }

        console.log(`[CreateToken] Starting for ${name} (${symbol}) by ${creatorAddress}...`);
        console.log(`[CreateToken] Using API: ${BAGS_API_BASE}`);

        // --- STEP 1: Create Token Info ---
        // Docs: https://docs.bags.fm/api-reference/create-token-info
        // Payload: Multipart/Form-Data
        const formData = new FormData();
        formData.append("name", name);
        formData.append("symbol", symbol);
        formData.append("imageUrl", image); // Assuming input is a URL string
        formData.append("description", `Token created on Neon Platform: ${name}`);

        const step1Response = await fetch(`${BAGS_API_BASE}/token-launch/create-token-info`, {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                // Do NOT set Content-Type manually for FormData, it sets the boundary
            },
            body: formData,
        });

        const step1Data = await step1Response.json();

        if (!step1Response.ok || !step1Data.success) {
            console.error("[CreateToken] Step 1 Failed:", step1Data);
            throw new Error(step1Data.error || `Step 1 (Info) Failed: ${step1Response.statusText}`);
        }

        const { tokenMint, tokenMetadata } = step1Data.response;
        console.log(`[CreateToken] Step 1 Success. Mint: ${tokenMint}`);

        // --- STEP 2: Create Launch Transaction ---
        // Docs: https://docs.bags.fm/api-reference/create-token-launch-transaction
        // Payload: JSON
        // Endpoint: /token-launch/create-launch-transaction (Note: docs URL vs title might differ, using doc example)

        const launchPayload = {
            tokenMint: tokenMint,
            ipfs: tokenMetadata, // Mapping tokenMetadata to ipfs field based on typical flow
            wallet: creatorAddress,
            initialBuyLamports: 0, // Default to 0 for now
            // configKey: "...", // Optional? Docs lists it. If this fails, we need create-config.
        };

        const step2Response = await fetch(`${BAGS_API_BASE}/token-launch/create-launch-transaction`, {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(launchPayload),
        });

        const step2Data = await step2Response.json();

        if (!step2Response.ok || !step2Data.success) {
            console.error("[CreateToken] Step 2 Failed:", step2Data);
            throw new Error(step2Data.error || `Step 2 (Launch Tx) Failed: ${step2Response.statusText}`);
        }

        console.log(`[CreateToken] Step 2 Success. Tx Generated.`);

        // Return final success response
        return new Response(JSON.stringify({
            success: true,
            transaction: step2Data.response, // Docs say response is the base58 tx string
            mint: tokenMint
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("[CreateToken] Error:", error);
        return new Response(JSON.stringify({
            message: error.message,
            error: error.message,
            details: error.stack
        }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};
