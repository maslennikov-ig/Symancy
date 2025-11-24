// supabase/functions/create-payment/index.ts
// TODO: Implement in T013 - YooKassa payment creation endpoint
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req) => {
  return new Response(
    JSON.stringify({ message: "Not implemented yet" }),
    { headers: { "Content-Type": "application/json" } },
  )
})
