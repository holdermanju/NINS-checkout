
import { timingSafeEqual } from "node:crypto";

const SITE = "https://nins-checkout.netlify.app";
const SANDBOX_LOCATION = "LDSSY825P3VN5";
const PRODUCTION_LOCATION = "LZWVJM7W8BSQG";

const SANDBOX_PRICES = {
  mid: 2508931,
  premium: 4236016
};

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(
    Buffer.from(a),
    Buffer.from(b)
  );
}

export default async function handler(request) {
  if (request.method === "GET") {
    return reply({
      mode: "sandbox",
      ready: Boolean(process.env.SQUARE_ACCESS_TOKEN),
      realPaymentsEnabled: false,
      productionTestAvailable: Boolean(
        process.env.SQUARE_PRODUCTION_ACCESS_TOKEN &&
        process.env.NINS_LIVE_TEST_KEY
      )
    });
  }

  if (request.method !== "POST") {
    return reply({ ok: false, message: "Method not allowed" }, 405);
  }

  const origin = request.headers.get("origin");
  if (origin !== SITE) {
    return reply({ ok: false, message: "Invalid origin" }, 403);
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return reply({ ok: false, message: "JSON required" }, 415);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return reply({ ok: false, message: "Invalid JSON" }, 400);
  }

  const mode = input.mode === "production" ? "production" : "sandbox";

  if (
    typeof input.sourceId !== "string" ||
    input.sourceId.length < 5 ||
    input.sourceId.length > 500 ||
    typeof input.idempotencyKey !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(input.idempotencyKey)
  ) {
    return reply({ ok: false, message: "Invalid payment request" }, 400);
  }

  let amount;
  let location;
  let token;
  let endpoint;

  if (mode === "production") {
    const secret = process.env.NINS_LIVE_TEST_KEY;

    if (
      input.confirmRealCharge !== true ||
      typeof input.testKey !== "string" ||
      !sameSecret(input.testKey, secret)
    ) {
      return reply({ ok: false, message: "Unauthorized live test" }, 403);
    }

    amount = 100;
    location = PRODUCTION_LOCATION;
    token = process.env.SQUARE_PRODUCTION_ACCESS_TOKEN;
    endpoint = "https://connect.squareup.com/v2/payments";
  } else {
    if (!Object.hasOwn(SANDBOX_PRICES, input.package)) {
      return reply({ ok: false, message: "Invalid package" }, 400);
    }

    amount = SANDBOX_PRICES[input.package];
    location = SANDBOX_LOCATION;
    token = process.env.SQUARE_ACCESS_TOKEN;
    endpoint = "https://connect.squareupsandbox.com/v2/payments";
  }

  if (!token) {
    return reply({ ok: false, message: "Payment configuration missing" }, 503);
  }

  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Square-Version": "2025-10-16"
      },
      body: JSON.stringify({
        source_id: input.sourceId,
        idempotency_key: input.idempotencyKey,
        amount_money: {
          amount,
          currency: "USD"
        },
        location_id: location,
        autocomplete: true,
        note: mode === "production"
          ? "NINS authorized real $1 integration test"
          : `NINS ${input.package} Sandbox simulation`
      })
    });

    const data = await result.json();

    if (!result.ok || !data.payment?.id) {
      return reply({
        ok: false,
        message: "Square did not approve the payment",
        code: data.errors?.[0]?.code || "UNKNOWN"
      }, 400);
    }

    return reply({
      ok: true,
      mode,
      amount,
      paymentId: data.payment.id,
      status: data.payment.status
    });
  } catch {
    return reply({
      ok: false,
      message: "Could not contact Square"
    }, 502);
  }
}
