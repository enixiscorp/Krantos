// ============================================================
// Supabase Edge Function: notify-new-lead
// Description: Déclenchée par un Webhook de base de données.
//              Envoie des notifications Web Push aux vendeurs
//              et aux super-administrateurs lors d'un nouveau lead.
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import webpush from "npm:web-push";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Clés VAPID générées précédemment
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "BCGaXgV61Hur-1YAV4k46RVmwGJOolnbHdMIEiVvWwu9iBbcXPzVgJzzbxZIH2EZHCr7SJhyeVXHWf8jM-7iVvY";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "wPsqSfgWpbSXRhXNPRm2yXIBEJKKYIO0FAGQaFcovdQ";

webpush.setVapidDetails(
  "mailto:support@krantos.com",
  vapidPublicKey,
  vapidPrivateKey
);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
  // Gère les requêtes OPTIONS (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const payload = await req.json();
    console.log("Webhook payload reçu:", payload);

    // Gère à la fois les formats d'événements de webhook Supabase ou les appels manuels
    const eventType = payload.type || payload.event || "INSERT";
    if (eventType !== "INSERT") {
      return new Response(JSON.stringify({ status: "ignored", reason: "L'événement n'est pas une insertion (INSERT)" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const lead = payload.record || payload.new || payload;
    if (!lead || !lead.id) {
      return new Response(JSON.stringify({ error: "Structure de lead manquante ou invalide" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const vendorId = lead.vendor_id;
    const userName = lead.user_name || "Un client";
    const totalPower = lead.total_power_needed ? `${lead.total_power_needed.toFixed(2)} W` : "non définie";

    // 1. Liste des utilisateurs (profile_id) à notifier
    const userIdsToNotify: string[] = [];

    // Ajouter le vendeur assigné
    if (vendorId) {
      const { data: vendorData, error: vErr } = await supabase
        .from("vendors")
        .select("profile_id")
        .eq("id", vendorId)
        .single();
      
      if (!vErr && vendorData?.profile_id) {
        userIdsToNotify.push(vendorData.profile_id);
      }
    }

    // Ajouter tous les super-administrateurs
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "super_admin");

    if (adminProfiles) {
      adminProfiles.forEach((p) => {
        if (!userIdsToNotify.includes(p.id)) {
          userIdsToNotify.push(p.id);
        }
      });
    }

    if (userIdsToNotify.length === 0) {
      return new Response(JSON.stringify({ status: "success", msg: "Aucun destinataire à notifier" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Récupérer les souscriptions push de ces destinataires
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIdsToNotify);

    if (subError) throw subError;

    console.log(`Notification push : ${subscriptions?.length || 0} abonnements actifs trouvés.`);

    // 3. Payload de la notification Web Push
    const notificationPayload = JSON.stringify({
      title: "Nouveau Lead Krantos ⚡",
      body: `Calcul énergétique complété par ${userName} (${totalPower}).`,
      url: "/business-dashboard",
    });

    // 4. Envoyer les notifications push en parallèle
    const results = await Promise.allSettled(
      (subscriptions || []).map(async (subRecord) => {
        try {
          const pushSubscription = subRecord.subscription;
          await webpush.sendNotification(pushSubscription, notificationPayload);
          return { success: true, id: subRecord.id, user_id: subRecord.user_id };
        } catch (pushErr) {
          console.error(`Échec d'envoi à la souscription ${subRecord.id} :`, pushErr);
          
          // Si la souscription a expiré ou n'est plus valide (Code 410 Gone / 404 Not Found), on la supprime
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            console.log(`Suppression de la souscription expirée ${subRecord.id} de la base de données.`);
            await supabase.from("push_subscriptions").delete().eq("id", subRecord.id);
          }
          return { success: false, id: subRecord.id, error: pushErr.message };
        }
      })
    );

    return new Response(JSON.stringify({ status: "success", results }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Erreur de l'Edge Function notify-new-lead :", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
