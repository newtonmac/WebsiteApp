#!/usr/bin/env python3
"""
Tesla Powerwall Local Proxy Server

Handles Tesla OAuth2 authentication and proxies API requests
to the Tesla Fleet API, solving browser CORS restrictions.

Usage:
    python3 tesla_proxy.py

Then open your Powerwall Dashboard - it will auto-detect the local proxy.
"""

import http.server
import json
import hashlib
import base64
import secrets
import ssl
import sys
import os
import time
import urllib.request
import urllib.parse
import urllib.error
from getpass import getpass
from http.cookies import SimpleCookie

PORT = 8099
TESLA_AUTH_BASE = "https://auth.tesla.com"
TESLA_AUTH_URL = TESLA_AUTH_BASE + "/oauth2/v3/authorize"
TESLA_TOKEN_URL = TESLA_AUTH_BASE + "/oauth2/v3/token"
TESLA_API_BASES = [
    "https://fleet-api.prd.na.vn.cloud.tesla.com",
    "https://owner-api.teslamotors.com",
]

# Token storage
tokens = {
    "access_token": None,
    "refresh_token": None,
    "expires_at": 0,
}

# SSL context that doesn't verify (for Tesla endpoints that may have issues)
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE


def b64url(data):
    """Base64url encode bytes."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def generate_pkce():
    """Generate PKCE code verifier and challenge."""
    verifier = secrets.token_urlsafe(64)
    challenge = b64url(hashlib.sha256(verifier.encode()).digest())
    return verifier, challenge


def http_request(url, data=None, headers=None, method=None):
    """Make an HTTP request and return (status, headers, body)."""
    if headers is None:
        headers = {}

    if data is not None and isinstance(data, dict):
        data = json.dumps(data).encode()
        if "Content-Type" not in headers:
            headers["Content-Type"] = "application/json"
    elif data is not None and isinstance(data, str):
        data = data.encode()

    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx, timeout=30)
        return resp.status, dict(resp.headers), resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


def authenticate_tesla(email, password):
    """
    Authenticate with Tesla using OAuth2 + PKCE.
    Similar to the approach used by tesla_auth.
    """
    code_verifier, code_challenge = generate_pkce()
    state = secrets.token_urlsafe(16)

    # Step 1: Get the login page (establishes session)
    auth_params = urllib.parse.urlencode({
        "client_id": "ownerapi",
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "redirect_uri": "https://auth.tesla.com/void/callback",
        "response_type": "code",
        "scope": "openid email offline_access",
        "state": state,
        "login_hint": email,
    })

    page_url = TESLA_AUTH_URL + "?" + auth_params

    print("  Fetching login page...")
    status, headers, body = http_request(page_url)

    if status != 200:
        raise Exception(f"Failed to load login page (HTTP {status})")

    # Extract hidden form fields and cookies
    import re

    # Get transaction_id from hidden input
    tx_match = re.search(r'name="_csrf"\s+value="([^"]+)"', body)
    csrf = tx_match.group(1) if tx_match else ""

    tx_match = re.search(r'name="transaction_id"\s+value="([^"]+)"', body)
    transaction_id = tx_match.group(1) if tx_match else ""

    # Get cookies from response
    cookies = {}
    for val in headers.get("Set-Cookie", "").split(","):
        if "=" in val:
            parts = val.strip().split(";")[0]
            if "=" in parts:
                k, v = parts.split("=", 1)
                cookies[k.strip()] = v.strip()

    cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())

    # Step 2: Submit credentials
    print("  Submitting credentials...")
    form_data = urllib.parse.urlencode({
        "_csrf": csrf,
        "_phase": "authenticate",
        "_process": "1",
        "transaction_id": transaction_id,
        "cancel": "",
        "identity": email,
        "credential": password,
    })

    # We need to handle redirects manually to capture the auth code
    # Build a custom opener that doesn't follow redirects
    class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None  # Don't follow redirects

    opener = urllib.request.build_opener(
        NoRedirectHandler,
        urllib.request.HTTPSHandler(context=ssl_ctx)
    )

    req = urllib.request.Request(
        page_url,
        data=form_data.encode(),
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookie_str,
        },
        method="POST",
    )

    try:
        resp = opener.open(req, timeout=30)
        status = resp.status
        resp_headers = dict(resp.headers)
        resp_body = resp.read().decode()
    except urllib.error.HTTPError as e:
        status = e.code
        resp_headers = dict(e.headers)
        resp_body = e.read().decode()

    # Check for MFA requirement
    if status == 200 and "passcode" in resp_body.lower():
        print("\n  Multi-factor authentication required.")
        mfa_code = input("  Enter MFA code from your authenticator app: ").strip()

        # Get updated cookies
        for val in resp_headers.get("Set-Cookie", "").split(","):
            if "=" in val:
                parts = val.strip().split(";")[0]
                if "=" in parts:
                    k, v = parts.split("=", 1)
                    cookies[k.strip()] = v.strip()
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())

        tx_match = re.search(r'name="transaction_id"\s+value="([^"]+)"', resp_body)
        if tx_match:
            transaction_id = tx_match.group(1)

        mfa_data = urllib.parse.urlencode({
            "_csrf": csrf,
            "_phase": "authenticate",
            "_process": "1",
            "transaction_id": transaction_id,
            "cancel": "",
            "passcode": mfa_code,
        })

        req = urllib.request.Request(
            page_url,
            data=mfa_data.encode(),
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": cookie_str,
            },
            method="POST",
        )

        try:
            resp = opener.open(req, timeout=30)
            status = resp.status
            resp_headers = dict(resp.headers)
        except urllib.error.HTTPError as e:
            status = e.code
            resp_headers = dict(e.headers)

    # Step 3: Extract authorization code from redirect
    auth_code = None
    if status in (301, 302, 303):
        location = resp_headers.get("Location", "")
        parsed = urllib.parse.urlparse(location)
        params = urllib.parse.parse_qs(parsed.query)
        auth_code = params.get("code", [None])[0]

    if not auth_code:
        # Try parsing from body (some flows return it differently)
        code_match = re.search(r'code=([^&"]+)', resp_body if 'resp_body' in dir() else "")
        if code_match:
            auth_code = code_match.group(1)

    if not auth_code:
        if "captcha" in resp_body.lower() if status == 200 else False:
            raise Exception("Tesla is requiring a CAPTCHA. Try again later or use a refresh token.")
        if "locked" in resp_body.lower() if status == 200 else False:
            raise Exception("Account appears to be locked. Wait and try again.")
        if status == 401:
            raise Exception("Invalid email or password.")
        raise Exception(
            f"Could not get authorization code (HTTP {status}). "
            "Check your credentials or try again later."
        )

    print("  Got authorization code, exchanging for tokens...")

    # Step 4: Exchange authorization code for tokens
    token_data = {
        "grant_type": "authorization_code",
        "client_id": "ownerapi",
        "code": auth_code,
        "code_verifier": code_verifier,
        "redirect_uri": "https://auth.tesla.com/void/callback",
    }

    status, _, body = http_request(
        TESLA_TOKEN_URL,
        data=token_data,
        headers={"Content-Type": "application/json"},
    )

    if status != 200:
        raise Exception(f"Token exchange failed (HTTP {status}): {body[:200]}")

    result = json.loads(body)
    tokens["access_token"] = result["access_token"]
    tokens["refresh_token"] = result["refresh_token"]
    tokens["expires_at"] = time.time() + result.get("expires_in", 3600)

    # Save refresh token for future sessions
    save_tokens()
    print("  Authentication successful!")
    return True


def refresh_access_token():
    """Refresh the access token using the refresh token."""
    if not tokens["refresh_token"]:
        raise Exception("No refresh token available")

    print("Refreshing access token...")
    status, _, body = http_request(
        TESLA_TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "client_id": "ownerapi",
            "refresh_token": tokens["refresh_token"],
            "scope": "openid email offline_access",
        },
        headers={"Content-Type": "application/json"},
    )

    if status != 200:
        raise Exception(f"Token refresh failed (HTTP {status})")

    result = json.loads(body)
    tokens["access_token"] = result["access_token"]
    if result.get("refresh_token"):
        tokens["refresh_token"] = result["refresh_token"]
    tokens["expires_at"] = time.time() + result.get("expires_in", 3600)
    save_tokens()
    print("Token refreshed successfully.")


def ensure_valid_token():
    """Ensure we have a valid access token, refreshing if needed."""
    if not tokens["access_token"] or time.time() > tokens["expires_at"] - 300:
        refresh_access_token()


def tesla_api_get(endpoint):
    """Make an authenticated GET request to Tesla's API."""
    ensure_valid_token()

    for base in TESLA_API_BASES:
        try:
            status, _, body = http_request(
                base + endpoint,
                headers={
                    "Authorization": "Bearer " + tokens["access_token"],
                    "Content-Type": "application/json",
                },
            )
            if status == 200:
                return json.loads(body)
            if status == 401:
                refresh_access_token()
                status, _, body = http_request(
                    base + endpoint,
                    headers={
                        "Authorization": "Bearer " + tokens["access_token"],
                        "Content-Type": "application/json",
                    },
                )
                if status == 200:
                    return json.loads(body)
        except Exception as e:
            print(f"  API call to {base} failed: {e}")
            continue

    raise Exception(f"All API endpoints failed for {endpoint}")


TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".tesla_tokens.json")


def save_tokens():
    """Save tokens to disk."""
    with open(TOKEN_FILE, "w") as f:
        json.dump(tokens, f)
    os.chmod(TOKEN_FILE, 0o600)


def load_tokens():
    """Load tokens from disk."""
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            saved = json.load(f)
            tokens.update(saved)
            return True
    return False


class TeslaProxyHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler that proxies Tesla API requests."""

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]

        # Health check
        if path == "/status":
            self.send_json({
                "status": "ok",
                "authenticated": tokens["access_token"] is not None,
                "expires_at": tokens["expires_at"],
            })
            return

        # Proxy Tesla API calls
        if path.startswith("/api/1/"):
            try:
                result = tesla_api_get(path)
                self.send_json(result)
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        path = self.path.split("?")[0]
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode() if content_length > 0 else ""

        # Login endpoint
        if path == "/auth/login":
            try:
                data = json.loads(body)
                email = data.get("email", "")
                password = data.get("password", "")

                if not email or not password:
                    self.send_json({"error": "Email and password required"}, 400)
                    return

                print(f"\nAuthenticating {email}...")
                authenticate_tesla(email, password)

                self.send_json({
                    "status": "ok",
                    "message": "Authenticated successfully",
                })

            except Exception as e:
                self.send_json({"error": str(e)}, 401)
            return

        # Token login (paste refresh token)
        if path == "/auth/token":
            try:
                data = json.loads(body)
                refresh_token = data.get("refresh_token", "")

                if not refresh_token:
                    self.send_json({"error": "Refresh token required"}, 400)
                    return

                tokens["refresh_token"] = refresh_token
                refresh_access_token()

                self.send_json({
                    "status": "ok",
                    "message": "Token authenticated successfully",
                })

            except Exception as e:
                self.send_json({"error": str(e)}, 401)
            return

        # Logout
        if path == "/auth/logout":
            tokens["access_token"] = None
            tokens["refresh_token"] = None
            tokens["expires_at"] = 0
            if os.path.exists(TOKEN_FILE):
                os.remove(TOKEN_FILE)
            self.send_json({"status": "ok", "message": "Logged out"})
            return

        self.send_json({"error": "Not found"}, 404)

    def log_message(self, format, *args):
        """Custom log formatting."""
        msg = format % args
        if "/status" not in msg:  # Don't spam status checks
            print(f"  [{self.log_date_time_string()}] {msg}")


def interactive_login():
    """Interactive terminal login flow."""
    print("\n" + "=" * 50)
    print("  Tesla Account Login")
    print("=" * 50)

    # Check for existing tokens
    if load_tokens() and tokens["refresh_token"]:
        print("\nFound saved session. Testing...")
        try:
            ensure_valid_token()
            print("Session is valid! Using saved credentials.")
            return True
        except Exception:
            print("Saved session expired. Please log in again.")

    print("\nChoose login method:")
    print("  1. Tesla email & password")
    print("  2. Paste a refresh token")
    print("  3. Skip (authenticate via dashboard)")

    choice = input("\nChoice [1/2/3]: ").strip()

    if choice == "1":
        email = input("Email: ").strip()
        password = getpass("Password: ")
        try:
            authenticate_tesla(email, password)
            return True
        except Exception as e:
            print(f"\nLogin failed: {e}")
            print("You can still authenticate via the dashboard.")
            return False

    elif choice == "2":
        token = input("Refresh token: ").strip()
        tokens["refresh_token"] = token
        try:
            refresh_access_token()
            return True
        except Exception as e:
            print(f"\nToken failed: {e}")
            return False

    return False


def main():
    print("""
╔══════════════════════════════════════════════════╗
║         Tesla Powerwall Local Proxy              ║
╚══════════════════════════════════════════════════╝
    """)

    interactive_login()

    print(f"\nStarting proxy server on http://localhost:{PORT}")
    print("The Powerwall Dashboard will auto-detect this server.")
    print("Press Ctrl+C to stop.\n")

    server = http.server.HTTPServer(("127.0.0.1", PORT), TeslaProxyHandler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down proxy server.")
        server.shutdown()


if __name__ == "__main__":
    main()
