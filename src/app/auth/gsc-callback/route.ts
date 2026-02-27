import { NextRequest, NextResponse } from "next/server";

/**
 * GSC OAuth callback — served as a raw HTML page via Route Handler.
 *
 * This MUST NOT be a React page (page.tsx) because the root layout wraps
 * everything in ConvexAuthProvider. A second ConvexReactClient in the popup
 * conflicts with the main window's auth state via shared localStorage,
 * killing the user's session.
 *
 * A Route Handler bypasses the layout system entirely — no React, no
 * providers, no auth conflict. It just relays the OAuth code back to
 * the opener window via postMessage.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code") ?? "";
  const state = searchParams.get("state") ?? "";
  const error = searchParams.get("error") ?? "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connecting Google Search Console...</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; background: #fafafa; }
    .card { text-align: center; padding: 2rem; }
    .spinner { width: 2rem; height: 2rem; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success { color: #16a34a; font-weight: 500; }
    .error { color: #dc2626; font-weight: 500; }
    .error-detail { color: #6b7280; font-size: 0.875rem; margin-top: 0.5rem; }
    .close-btn { margin-top: 1rem; padding: 0.5rem 1rem; font-size: 0.875rem; border: 1px solid #d1d5db; border-radius: 0.5rem; background: white; cursor: pointer; }
    .close-btn:hover { background: #f9fafb; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="spinner" id="spinner"></div>
    <p id="message">Connecting Google Search Console...</p>
  </div>
  <script>
    (function() {
      var code = ${JSON.stringify(code)};
      var state = ${JSON.stringify(state)};
      var error = ${JSON.stringify(error)};

      var card = document.getElementById("card");
      var spinner = document.getElementById("spinner");
      var message = document.getElementById("message");

      if (error) {
        spinner.style.display = "none";
        message.className = "error";
        message.textContent = error === "access_denied" ? "Access was denied." : "Error: " + error;
        card.innerHTML += '<button class="close-btn" onclick="window.close()">Close</button>';
        return;
      }

      if (!code || !state) {
        spinner.style.display = "none";
        message.className = "error";
        message.textContent = "Missing authorization code.";
        card.innerHTML += '<button class="close-btn" onclick="window.close()">Close</button>';
        return;
      }

      if (window.opener) {
        window.opener.postMessage(
          { type: "gsc-callback", code: code, state: state },
          window.location.origin
        );
        spinner.style.display = "none";
        message.className = "success";
        message.textContent = "Connected! This window will close automatically.";
        setTimeout(function() { window.close(); }, 1200);
      } else {
        spinner.style.display = "none";
        message.className = "error";
        message.textContent = "Could not communicate with the main window.";
        card.innerHTML += '<p class="error-detail">Please close this tab and try again.</p>';
        card.innerHTML += '<button class="close-btn" onclick="window.close()">Close</button>';
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
