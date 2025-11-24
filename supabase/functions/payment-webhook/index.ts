// supabase/functions/payment-webhook/index.ts
// TODO: Implement in T024 - YooKassa webhook handler with signature verification
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req) => {
  return new Response(
    JSON.stringify({ message: "Not implemented yet" }),
    { headers: { "Content-Type": "application/json" } },
  )
})
