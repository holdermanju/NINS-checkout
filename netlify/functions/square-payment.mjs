
const SITE = "https://nins-checkout.netlify.app";
const LOCATION_ID = "LZWVJM7W8BSQG";
const SQUARE_API = "https://connect.squareup.com/v2/payments";

const PACKAGES = Object.freeze({
  mid: {
    name: "Mid-Tier Security Equipment",
    amount: 2508931
  },
  premium: {
    name: "Premium Security Equipment",
    amount: 4236016
  }
});

// One fixed payment attempt identity for this specific project.
// Using the same key for either package helps prevent
// repeated or conflicting charges for this order.
const PAYMENT_KEY = "nins-david-equipment-2026-original";
const REFERENCE_ID = "NINS-DAVID-EQUIPMENT-2026";

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export default async function handler(request) {
  const token = process.env.SQUARE_PRODUCTION_ACCESS_TOKEN;

  if (request.method === "GET") {
    return reply({
      mode: "production",
      ready: Boolean(token),
      realPaymentsEnabled: Boolean(token)
    });
  }

  if (request.method !== "POST") {
    return reply({
      ok: false,
      message: "Method not allowed"
    }, 405);
  }

  const origin = request.headers.get("origin");

  if (origin && origin !== SITE) {
    return reply({
      ok: false,
      message: "Invalid checkout origin"
    }, 403);
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return reply({
      ok: false,
      message: "JSON required"
    }, 415);
  }

  if (!token) {
    return reply({
      ok: false,
      message: "Square Production is not configured"
    }, 503);
  }

  let input;

  try {
    input = await request.json();
  } catch {
    return reply({
      ok: false,
      message: "Invalid request"
    }, 400);
  }

  const selected = input.package;
  const chosenPackage = PACKAGES[selected];

  if (
    input.mode !== "production" ||
    !Object.hasOwn(PACKAGES, selected) ||
    !chosenPackage
  ) {
    return reply({
      ok: false,
      message: "Invalid equipment package"
    }, 400);
  }

  if (
    typeof input.sourceId !== "string" ||
    input.sourceId.length < 5 ||
    input.sourceId.length > 500
  ) {
    return reply({
      ok: false,
      message: "Invalid card token"
    }, 400);
  }

  const buyerEmail = String(input.buyerEmail || "").trim();

  if (
    buyerEmail.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)
  ) {
    return reply({
      ok: false,
      message: "A valid receipt email is required"
    }, 400);
  }

  // The server chooses the amount.
  // Browser-supplied prices are ignored.
  const amount = chosenPackage.amount;

  try {
    const squareResponse = await fetch(SQUARE_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Square-Version": "2026-09-16"
      },
      body: JSON.stringify({
        source_id: input.sourceId,
        idempotency_key: PAYMENT_KEY,
        location_id: LOCATION_ID,
        amount_money: {
          amount: amount,
          currency: "USD"
        },
        buyer_email_address: buyerEmail,
        autocomplete: true,
        reference_id: REFERENCE_ID,
        note: `NINS David equipment: ${chosenPackage.name}`
      })
    });

    const result = await squareResponse.json();
    const payment = result.payment;

    if (!squareResponse.ok || !payment) {
      return reply({
        ok: false,
        message: "Square did not complete this payment. Check your Square Dashboard before retrying.",
        code: result.errors?.[0]?.code || "PAYMENT_ERROR"
      }, 400);
    }

    if (
      payment.status !== "COMPLETED" ||
      payment.amount_money?.amount !== amount ||
      payment.amount_money?.currency !== "USD" ||
      payment.location_id !== LOCATION_ID
    ) {
      return reply({
        ok: false,
        message: "Payment requires manual verification. Do not retry until checking Square."
      }, 409);
    }

    return reply({
      ok: true,
      mode: "production",
      status: payment.status,
      amount: payment.amount_money.amount,
      paymentId: payment.id,
      receiptUrl: payment.receipt_url || null,
      package: selected
    });

  } catch {
    return reply({
      ok: false,
      message: "Payment result is uncertain. Check Square before trying again."
    }, 502);
  }
}
