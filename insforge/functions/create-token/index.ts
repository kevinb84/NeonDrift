import fetch from "npm:node-fetch";
import FormDataNode from "npm:form-data";

const BAGS_API_BASE = "https://public-api-v2.bags.fm/api/v1";

Deno.serve(async (req) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { name, symbol, image, description, socials, creatorAddress, initialBuyLamports } = await req.json();
        const apiKey = Deno.env.get("BAGS_API_KEY");

        if (!apiKey) {
            throw new Error("Server misconfiguration: BAGS_API_KEY missing");
        }

        console.log(`[CreateToken] Step 1: Info for ${name} by ${creatorAddress}`);
        
        // --- STEP 1: Create Token Info ---
        const formData = new FormDataNode();
        formData.append("name", name);
        formData.append("symbol", symbol.toUpperCase().replace('$', ''));
        formData.append("imageUrl", image);
        formData.append("description", description || `Powered by Neon Drift: ${name}`);
        if(socials?.twitter) formData.append("twitter", socials.twitter);
        if(socials?.website) formData.append("website", socials.website);
        if(socials?.telegram) formData.append("telegram", socials.telegram);

        const step1Response = await fetch(`${BAGS_API_BASE}/token-launch/create-token-info`, {
            method: "POST",
            headers: { 
                "x-api-key": apiKey,
                ...formData.getHeaders()
            },
            body: formData as any,
        });

        const step1Data = await step1Response.json();
        if (!step1Response.ok || !step1Data.success) {
            throw new Error(step1Data.error || `Step 1 Failed: ${step1Response.statusText}`);
        }
        const { tokenMint, tokenMetadata } = step1Data.response;

        // --- STEP 2: Fee Share Config ---
        console.log(`[CreateToken] Step 2: Fee config for ${tokenMint}`);
        const feePayload = {
            payer: creatorAddress,
            baseMint: tokenMint,
            feeClaimers: [{ user: creatorAddress, userBps: 10000 }] // 100% to creator
        };

        const step2Response = await fetch(`${BAGS_API_BASE}/fee-share/config`, {
            method: "POST",
            headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify(feePayload),
        });

        const step2Data = await step2Response.json();
        if (!step2Response.ok || !step2Data.success) {
            throw new Error(step2Data.error || `Step 2 Failed: ${step2Response.statusText}`);
        }
        
        const configTransactions = step2Data.response.transactions || [];
        const configKey = step2Data.response.meteoraConfigKey;

        // --- STEP 3: Launch Transaction ---
        console.log(`[CreateToken] Step 3: Launch transaction`);
        const launchPayload = {
            tokenMint: tokenMint,
            metadataUrl: tokenMetadata,
            launchWallet: creatorAddress,
            initialBuyLamports: initialBuyLamports || 0,
            configKey: configKey,
        };

        const step3Response = await fetch(`${BAGS_API_BASE}/token-launch/create-launch-transaction`, {
            method: "POST",
            headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify(launchPayload),
        });

        const step3Data = await step3Response.json();
        if (!step3Response.ok || !step3Data.success) {
            throw new Error(step3Data.error || `Step 3 Failed: ${step3Response.statusText}`);
        }
        const launchTx = step3Data.response; 

        // Return array of transactions to sign
        return new Response(JSON.stringify({
            success: true,
            transactions: [...configTransactions, launchTx],
            mint: tokenMint
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("[CreateToken] Error:", error);
        return new Response(JSON.stringify({
            message: error.message,
            error: error.message
        }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
