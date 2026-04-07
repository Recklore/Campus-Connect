/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 10000);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postJson(path, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return {
      status: response.status,
      ok: response.ok,
      message: data?.message || "",
    };
  } catch (error) {
    return {
      status: -1,
      ok: false,
      message: error?.message || "Request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runBurst({
  name,
  path,
  count,
  makePayload,
  pauseMs = 0,
}) {
  const statuses = [];
  let first429At = null;

  for (let i = 0; i < count; i += 1) {
    const payload = makePayload(i);
    const result = await postJson(path, payload);
    statuses.push(result.status);

    if (first429At === null && result.status === 429) {
      first429At = i + 1;
    }

    if (pauseMs > 0) {
      await wait(pauseMs);
    }
  }

  const histogram = statuses.reduce((acc, code) => {
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {});

  return {
    name,
    path,
    count,
    first429At,
    histogram,
  };
}

function printResult(result, expectedOnCleanWindow) {
  console.log(`\n[${result.name}] ${result.path}`);
  console.log(`  Sent: ${result.count}`);
  console.log(`  First 429 at request #: ${result.first429At ?? "not reached"}`);
  console.log(`  Status histogram: ${JSON.stringify(result.histogram)}`);

  if (expectedOnCleanWindow) {
    console.log(`  Expected first 429 on clean window: ${expectedOnCleanWindow}`);
    if (result.first429At !== expectedOnCleanWindow) {
      console.log("  Note: mismatch can happen if limiter counters already exist in Redis/IP window.");
    }
  }
}

function buildStudentEnrollment(index) {
  const seq = String(index + 1).padStart(3, "0");
  return `2021CSEIT${seq}`;
}

async function main() {
  console.log(`Rate-limit test base URL: ${BASE_URL}`);
  console.log("Tip: run on a fresh limiter window for exact threshold matches.");

  // loginLimiter max=10 per 15 min key -> expect 429 at 11
  const loginResult = await runBurst({
    name: "loginLimiter",
    path: "/auth/login",
    count: 12,
    makePayload: () => ({
      role: "student",
      enrollmentNumber: "2021CSEIT001",
      password: "WrongPass1!",
    }),
  });
  printResult(loginResult, 11);

  // guestLimiter max=150 per 15 min key -> expect 429 at 151
  const guestResult = await runBurst({
    name: "guestLimiter",
    path: "/auth/guestLogin",
    count: 152,
    makePayload: () => ({}),
  });
  printResult(guestResult, 151);

  // signupLimiter max=10 per 15 min key -> expect 429 at 11
  // Invalid short password prevents controller side-effects (email sending), while limiter still applies.
  const signupResult = await runBurst({
    name: "signupLimiter",
    path: "/auth/signup",
    count: 12,
    makePayload: () => ({
      role: "student",
      enrollmentNumber: "2021CSEIT777",
      password: "x",
    }),
  });
  printResult(signupResult, 11);

  // ipCeilingLimiter max=30 per 1 hour IP on signup routes.
  // We already consumed 12 signup hits above on the same IP/key path.
  // On a clean window, first 429 should appear at request #19 in this scenario (30+1 total).
  const ipCeilingResult = await runBurst({
    name: "ipCeilingLimiter",
    path: "/auth/signup",
    count: 24,
    makePayload: (i) => ({
      role: "student",
      enrollmentNumber: buildStudentEnrollment(i),
      password: "x",
    }),
  });
  printResult(ipCeilingResult, 19);

  console.log("\nNot endpoint-testable from this script:");
  console.log("  - authLimiter (defined but not mounted on any route currently)");
}

main().catch((error) => {
  console.error("Rate-limit test script failed:", error);
  process.exitCode = 1;
});
