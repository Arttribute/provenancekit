import { ProvenanceKitError, ApiErrorBody } from "./errors";

export interface ApiClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
}

export class Api {
  private readonly base: string;
  private readonly key?: string;
  private readonly f: typeof fetch;

  constructor(opts: ApiClientOptions) {
    this.base = (
      opts.baseUrl ??
      "https://arttribute-provenancekit-api-prod-848878149972.europe-west1.run.app"
    ).replace(/\/$/, "");
    this.key = opts.apiKey;
    this.f = opts.fetchFn ?? fetch;
  }

  private h(extra: HeadersInit = {}) {
    return this.key ? { Authorization: `Bearer ${this.key}`, ...extra } : extra;
  }

  private async parse<T>(res: Response): Promise<T> {
    const txt = await res.text();
    if (!res.ok) {
      let body: ApiErrorBody | undefined;
      try {
        body = JSON.parse(txt);
      } catch {}
      if (body?.error) throw ProvenanceKitError.fromResponse(res.status, body);
      throw new ProvenanceKitError("Server", txt || res.statusText, res.status);
    }
    return txt ? (JSON.parse(txt) as T) : (undefined as unknown as T);
  }

  get<T>(path: string) {
    return this.f(`${this.base}${path}`, { headers: this.h() }).then((r) =>
      this.parse<T>(r)
    );
  }

  postJSON<T>(path: string, body: unknown) {
    return this.f(`${this.base}${path}`, {
      method: "POST",
      headers: this.h({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }).then((r) => this.parse<T>(r));
  }

  postForm<T>(path: string, form: FormData) {
    return this.f(`${this.base}${path}`, {
      method: "POST",
      headers: this.h(),
      body: form,
    }).then((r) => this.parse<T>(r));
  }
}
