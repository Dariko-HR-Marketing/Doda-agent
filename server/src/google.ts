export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export interface GoogleClient {
  authUrl(p: { state: string; challenge: string }): string;
  exchange(p: { code: string; verifier: string }): Promise<GoogleProfile>;
}

/** Google OAuth 2.0 (authorization code + PKCE). Profil access token orqali userinfo'dan olinadi (TLS, to'g'ridan-to'g'ri token endpoint'dan). */
export class HttpGoogleClient implements GoogleClient {
  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string,
    private fetchFn: typeof fetch = fetch,
  ) {}

  authUrl({ state, challenge }: { state: string; challenge: string }): string {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "openid email",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return u.toString();
  }

  async exchange({ code, verifier }: { code: string; verifier: string }): Promise<GoogleProfile> {
    const tokenRes = await this.fetchFn("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!tokenRes.ok) throw new Error(`google token ${tokenRes.status}`);
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) throw new Error("google token missing");

    const infoRes = await this.fetchFn("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new Error(`google userinfo ${infoRes.status}`);
    const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean };
    if (!info.sub || !info.email) throw new Error("google profile incomplete");
    return { sub: info.sub, email: info.email, emailVerified: info.email_verified === true };
  }
}
