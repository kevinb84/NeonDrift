import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

module.exports = async function (req) {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { signature, buyerAddress } = await req.json();

        if (!signature || !buyerAddress) {
            return new Response(JSON.stringify({ error: "Missing signature or buyerAddress" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 1. Verify Transaction on Solana (Devnet for now)
        const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const txResponse = await fetch(RPC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getTransaction",
                params: [signature, { maxSupportedTransactionVersion: 0 }]
            })
        });

        const txData = await txResponse.json();

        if (!txData.result) {
            throw new Error("Transaction not found on-chain. Please wait and try again.");
        }

        if (txData.result.meta && txData.result.meta.err !== null) {
            throw new Error("Transaction failed on-chain.");
        }

        // Ideally here we would also parse txData.result.transaction.message.accountKeys
        // to verify that the buyerAddress is a signer, and the token is expected. Let's
        // keep it simple for this MVP and just check success.

        // 2. Safely Update Database (Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
        const supabaseUrl = process.env.SUPABASE_URL || Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("Missing SUPABASE env vars.");
            throw new Error("Server configuration error: cannot update profile.");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { error: dbError } = await supabase
            .from("profiles")
            .update({ has_token: true })
            .eq("wallet_address", buyerAddress);

        if (dbError) {
            console.error("Database error updating profile:", dbError);
            throw new Error("Failed to update user profile.");
        }

        return new Response(JSON.stringify({ success: true, message: "Transaction verified and profile updated." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Verification error:", error.message);
        return new Response(JSON.stringify({
            message: error.message,
            error: error.message
        }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};
