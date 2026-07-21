import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const { deviceId, deviceName, location, orgName, designation, avatarName } = await req.json();

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: "deviceId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Check if device already exists and is approved
    const { data: existing } = await supabaseClient
      .from("user_devices")
      .select("id, approved, status")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (existing?.approved) {
      return new Response(
        JSON.stringify(existing),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const payload = {
      device_id: deviceId,
      user_id: null,
      org_name: orgName || null,
      user_name: deviceName || null,
      device_name: deviceName || null,
      location: location || null,
      designation: designation || null,
      avatar_name: avatarName || null,
      approved: false,
      status: "pending",
      requested_at: new Date().toISOString(),
      approved_at: null,
      approved_by: null,
      valid_upto: null,
    };

    const { data, error } = await supabaseClient
      .from("user_devices")
      .upsert(payload, { onConflict: "device_id" })
      .select("id, device_id, approved, status, valid_upto")
      .maybeSingle();

    if (error) throw error;

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
