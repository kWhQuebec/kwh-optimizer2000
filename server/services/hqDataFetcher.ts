import { createLogger } from "../lib/logger";
import crypto from "crypto";

const log = createLogger("HQ-DataFetcher");

const HOST_LOGIN = "https://connexion.solutions.hydroquebec.com";
const HOST_SESSION = "https://session.hydroquebec.com";
const HOST_SERVICES = "https://services-cl.solutions.hydroquebec.com";

const AZB2C_TENANT_ID = "32bf9b91-0a36-4385-b231-d9a8fa3b05ab";
const AZB2C_POLICY = "B2C_1A_PRD_signup_signin";
const AZB2C_CLIENT_ID = "09b0ae72-6db8-4ecc-a1be-041b67afc1cd";
const AZB2C_SCOPE = "openid https://connexionhq.onmicrosoft.com/hq-clientele/Espace.Client";
const AUTH_CALLBACK_URL = `${HOST_SESSION}/oauth2/callback`;

const AUTHORIZE_URL = `${HOST_LOGIN}/${AZB2C_TENANT_ID}/${AZB2C_POLICY.toLowerCase()}/oauth2/v2.0/authorize`;
const AUTH_URL = `${HOST_LOGIN}/${AZB2C_TENANT_ID}/${AZB2C_POLICY}/SelfAsserted`;
const CONFIRMED_URL = `${HOST_LOGIN}/${AZB2C_TENANT_ID}/${AZB2C_POLICY}/api/CombinedSigninAndSignup/confirmed`;
const TOKEN_URL = `${HOST_LOGIN}/${AZB2C_TENANT_ID}/${AZB2C_POLICY.toLowerCase()}/oauth2/v2.0/token`;
const RELATION_URL = `${HOST_SERVICES}/wsapi/web/prive/api/v1_0/relations`;
const SESSION_URL = `${HOST_SERVICES}/lsw/portail/prive/maj-session/`;
const PORTRAIT_URL = `${HOST_SERVICES}/lsw/portail/fr/group/clientele/portrait-de-consommation`;
const PERIOD_DATA_URL = `${HOST_SERVICES}/lsw/portail/fr/group/clientele/portrait-de-consommation/resourceObtenirDonneesPeriodesConsommation`;
const CONSO_CSV_URL = `${HOST_SERVICES}/lsw/portail/fr/group/clientele/portrait-de-consommation/resourceTelechargerDonneesConsommation`;
const CONSO_OVERVIEW_CSV_URL = `${HOST_SERVICES}/lsw/portail/en/group/clientele/portrait-de-consommation/resourceTelechargerPeriodesFacturation`;
const CONTRACT_LIST_URL = `${HOST_SERVICES}/wsapi/web/prive/api/v3_0/partenaires/contrats`;
const CONTRACT_SUMMARY_URL = `${HOST_SERVICES}/wsapi/web/prive/api/v3_0/partenaires/calculerSommaireContractuel?indMAJNombres=true`;

const REQUEST_TIMEOUT_MS = 30_000;

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

export interface HQContract {
  contractId: string;
  accountId: string;
  address: string;
  meterId: string;
  rateCode: string;
}

export interface HQPeriod {
  startDate: string;
  endDate: string;
  contractId: string;
}

export interface HQDownloadResult {
  contractId: string;
  meterId: string;
  address: string;
  csvFiles: Array<{
    option: string;
    periodStart: string;
    periodEnd: string;
    csvContent: string;
    rowCount: number;
  }>;
}

export interface HQProgress {
  stage: string;
  message: string;
  current: number;
  total: number;
  details?: string;
}

export type ProgressCallback = (progress: HQProgress) => void;

interface RequestOptions {
  headers?: Record<string, string>;
  body?: string | URLSearchParams;
  redirect?: RequestRedirect;
  contentType?: string;
}

export class HQDataFetcher {
  private accessToken: string = "";
  private refreshToken: string = "";
  private cookies: Map<string, string> = new Map();
  private guid: string = crypto.randomUUID();

  constructor(private onProgress?: ProgressCallback) {}

  private _reportProgress(
    stage: string,
    message: string,
    current: number,
    total: number,
    details?: string,
  ) {
    if (this.onProgress) {
      this.onProgress({ stage, message, current, total, details });
    }
    log.info(`[${stage}] ${message}${details ? ` — ${details}` : ""}`);
  }

  private _buildCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  private _parseCookies(response: Response) {
    const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
    for (const raw of setCookieHeaders) {
      const pair = raw.split(";")[0];
      if (!pair) continue;
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const name = pair.substring(0, eqIdx).trim();
      const value = pair.substring(eqIdx + 1).trim();
      if (name) {
        this.cookies.set(name, value);
      }
    }
  }

  private async _makeRequest(
    url: string,
    method: "GET" | "POST" = "GET",
    options: RequestOptions = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...(options.headers ?? {}),
    };

    const cookieStr = this._buildCookieHeader();
    if (cookieStr) {
      headers["Cookie"] = cookieStr;
    }

    if (options.contentType) {
      headers["Content-Type"] = options.contentType;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
        redirect: options.redirect ?? "follow",
      };

      if (options.body) {
        fetchOptions.body =
          options.body instanceof URLSearchParams
            ? options.body.toString()
            : options.body;
      }

      const response = await fetch(url, fetchOptions);
      this._parseCookies(response);
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private _getCustomerHeaders(
    applicantId: string,
    customerId: string,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      NO_PARTENAIRE_DEMANDEUR: applicantId,
      NO_PARTENAIRE_TITULAIRE: customerId,
      DATE_DERNIERE_VISITE: new Date().toISOString(),
      GUID_SESSION: this.guid,
    };
  }

  private async _createWebSession(
    applicantId: string,
    customerId: string,
  ): Promise<void> {
    log.info("Creating web session for HQ portal");
    const url = `${SESSION_URL}?mode=web`;
    const response = await this._makeRequest(url, "GET", {
      headers: this._getCustomerHeaders(applicantId, customerId),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to create web session: ${response.status} — ${text.substring(0, 200)}`,
      );
    }
    log.info("Web session created successfully");
  }

  private async _selectContract(
    applicantId: string,
    customerId: string,
    contractId: string,
  ): Promise<void> {
    log.info(`Selecting contract ${contractId}`);
    const url = `${PORTRAIT_URL}?noContrat=${contractId}`;
    const response = await this._makeRequest(url, "GET", {
      headers: this._getCustomerHeaders(applicantId, customerId),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to select contract ${contractId}: ${response.status} — ${text.substring(0, 200)}`,
      );
    }
    log.info(`Contract ${contractId} selected`);
  }

  async login(username: string, password: string): Promise<boolean> {
    this._reportProgress("auth", "Starting OAuth2 PKCE authentication", 0, 4);

    try {
      const { verifier, challenge } = generatePKCE();
      const state = crypto.randomBytes(16).toString("hex");
      const nonce = crypto.randomBytes(16).toString("hex");

      const authorizeParams = new URLSearchParams({
        client_id: AZB2C_CLIENT_ID,
        response_type: "code",
        redirect_uri: AUTH_CALLBACK_URL,
        scope: AZB2C_SCOPE,
        state,
        nonce,
        code_challenge: challenge,
        code_challenge_method: "S256",
        response_mode: "query",
        prompt: "login",
        ui_locales: "fr",
      });

      const authorizeUrl = `${AUTHORIZE_URL}?${authorizeParams.toString()}`;
      this._reportProgress(
        "auth",
        "Fetching authorization page",
        1,
        4,
        "Extracting CSRF token",
      );

      const authPageResp = await this._makeRequest(authorizeUrl, "GET");
      if (!authPageResp.ok) {
        throw new Error(
          `Authorization page returned ${authPageResp.status}`,
        );
      }
      const authPageHtml = await authPageResp.text();

      const csrfMatch = authPageHtml.match(
        /name="csrf_token"[^>]*value="([^"]+)"/,
      ) ?? authPageHtml.match(/"csrf_token"\s*:\s*"([^"]+)"/);

      const transIdMatch = authPageHtml.match(
        /name="transId"[^>]*value="([^"]+)"/,
      ) ?? authPageHtml.match(/"transId"\s*:\s*"([^"]+)"/) ??
        authPageHtml.match(/transId=([^&"]+)/);

      if (!csrfMatch || !transIdMatch) {
        log.error(
          "Could not extract CSRF/transId from authorization page",
        );
        throw new Error(
          "Failed to extract authentication tokens from HQ login page",
        );
      }

      const csrfToken = csrfMatch[1];
      const transId = transIdMatch[1];
      log.info("Extracted CSRF token and transId");

      this._reportProgress(
        "auth",
        "Submitting credentials",
        2,
        4,
        "Authenticating with HQ",
      );

      const selfAssertedParams = new URLSearchParams({
        tx: transId,
        p: AZB2C_POLICY,
      });
      const selfAssertedUrl = `${AUTH_URL}?${selfAssertedParams.toString()}`;

      const credentialsBody = new URLSearchParams({
        request_type: "RESPONSE",
        signInName: username,
        password: password,
      });

      const selfAssertedResp = await this._makeRequest(
        selfAssertedUrl,
        "POST",
        {
          body: credentialsBody,
          contentType: "application/x-www-form-urlencoded",
          headers: {
            "X-CSRF-TOKEN": csrfToken,
            Referer: authorizeUrl,
          },
        },
      );

      if (!selfAssertedResp.ok) {
        const errorText = await selfAssertedResp.text();
        if (
          errorText.includes("INVALID_CREDENTIALS") ||
          errorText.includes("incorrect")
        ) {
          log.warn("Invalid HQ credentials provided");
          return false;
        }
        throw new Error(
          `SelfAsserted failed: ${selfAssertedResp.status} — ${errorText.substring(0, 200)}`,
        );
      }

      const selfAssertedBody = await selfAssertedResp.text();
      if (
        selfAssertedBody.includes("INVALID_CREDENTIALS") ||
        selfAssertedBody.includes("Your account has been locked")
      ) {
        log.warn("Invalid HQ credentials or account locked");
        return false;
      }

      this._reportProgress(
        "auth",
        "Retrieving authorization code",
        3,
        4,
        "Following redirect",
      );

      const confirmedParams = new URLSearchParams({
        rememberMe: "false",
        csrf_token: csrfToken,
        tx: transId,
        p: AZB2C_POLICY,
      });
      const confirmedUrl = `${CONFIRMED_URL}?${confirmedParams.toString()}`;

      const confirmedResp = await this._makeRequest(confirmedUrl, "GET", {
        redirect: "manual",
        headers: {
          Referer: authorizeUrl,
        },
      });

      const redirectLocation = confirmedResp.headers.get("location");
      if (!redirectLocation) {
        throw new Error(
          "No redirect location received from confirmed endpoint",
        );
      }

      const redirectUrl = new URL(redirectLocation);
      const authCode = redirectUrl.searchParams.get("code");
      if (!authCode) {
        const errorDesc = redirectUrl.searchParams.get("error_description");
        throw new Error(
          `No auth code in redirect: ${errorDesc ?? redirectLocation.substring(0, 200)}`,
        );
      }

      log.info("Authorization code obtained");

      this._reportProgress(
        "auth",
        "Exchanging code for access token",
        4,
        4,
        "Finalizing authentication",
      );

      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code: authCode,
        redirect_uri: AUTH_CALLBACK_URL,
        client_id: AZB2C_CLIENT_ID,
        code_verifier: verifier,
        scope: AZB2C_SCOPE,
      });

      const tokenResp = await this._makeRequest(TOKEN_URL, "POST", {
        body: tokenBody,
        contentType: "application/x-www-form-urlencoded",
      });

      if (!tokenResp.ok) {
        const errorText = await tokenResp.text();
        throw new Error(
          `Token exchange failed: ${tokenResp.status} — ${errorText.substring(0, 200)}`,
        );
      }

      const tokenData = await tokenResp.json();
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token ?? "";

      if (!this.accessToken) {
        throw new Error("No access_token received from token endpoint");
      }

      log.info("Successfully authenticated with Hydro-Québec");
      return true;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      log.error(`Authentication failed: ${message}`);
      throw error;
    }
  }

  async getAccounts(): Promise<
    Array<{ applicantId: string; customerId: string }>
  > {
    log.info("Fetching account relations");

    const response = await this._makeRequest(RELATION_URL, "GET", {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to fetch relations: ${response.status} — ${text.substring(0, 200)}`,
      );
    }

    const data = await response.json();
    const accounts: Array<{ applicantId: string; customerId: string }> = [];

    if (data?.relations && Array.isArray(data.relations)) {
      for (const relation of data.relations) {
        const applicantId =
          relation.noPartenaireDemandeur ??
          relation.applicantId ??
          relation.noDemandeur;
        const customerId =
          relation.noPartenaireTitulaire ??
          relation.customerId ??
          relation.noTitulaire;

        if (applicantId && customerId) {
          accounts.push({
            applicantId: String(applicantId),
            customerId: String(customerId),
          });
        }
      }
    }

    if (accounts.length === 0 && data) {
      const applicantId =
        data.noPartenaireDemandeur ?? data.applicantId ?? data.noDemandeur;
      const customerId =
        data.noPartenaireTitulaire ?? data.customerId ?? data.noTitulaire;

      if (applicantId && customerId) {
        accounts.push({
          applicantId: String(applicantId),
          customerId: String(customerId),
        });
      }
    }

    log.info(`Found ${accounts.length} account(s)`);
    return accounts;
  }

  async getContracts(
    applicantId: string,
    customerId: string,
  ): Promise<HQContract[]> {
    log.info(`Fetching contracts for customer ${customerId}`);

    await this._createWebSession(applicantId, customerId);

    const summaryResp = await this._makeRequest(CONTRACT_SUMMARY_URL, "GET", {
      headers: this._getCustomerHeaders(applicantId, customerId),
    });

    if (!summaryResp.ok) {
      const text = await summaryResp.text();
      throw new Error(
        `Contract summary failed: ${summaryResp.status} — ${text.substring(0, 200)}`,
      );
    }

    const summaryData = await summaryResp.json();
    const contracts: HQContract[] = [];

    const contractList =
      summaryData?.comptesContrats ??
      summaryData?.contrats ??
      summaryData?.contracts ??
      [];

    for (const account of Array.isArray(contractList) ? contractList : []) {
      const accountId =
        account.noCompteContrat ?? account.accountId ?? "";
      const innerContracts =
        account.listeContrats ??
        account.contrats ??
        account.contracts ??
        [];

      for (const contract of Array.isArray(innerContracts)
        ? innerContracts
        : []) {
        contracts.push({
          contractId: String(
            contract.noContrat ?? contract.contractId ?? "",
          ),
          accountId: String(accountId),
          address: String(
            contract.adresse ??
              contract.address ??
              contract.adresseComplete ??
              "",
          ),
          meterId: String(
            contract.noCompteur ?? contract.meterId ?? "",
          ),
          rateCode: String(
            contract.codeTarif ?? contract.rateCode ?? "",
          ),
        });
      }
    }

    if (contracts.length === 0 && summaryData) {
      const body = {
        listeServices: ["PC"],
        comptesContrats: [
          {
            listeNoContrat: [] as string[],
            noCompteContrat: "",
            titulaire: customerId,
          },
        ],
      };

      const listResp = await this._makeRequest(CONTRACT_LIST_URL, "POST", {
        headers: {
          ...this._getCustomerHeaders(applicantId, customerId),
        },
        body: JSON.stringify(body),
        contentType: "application/json",
      });

      if (listResp.ok) {
        const listData = await listResp.json();
        const items =
          listData?.contrats ?? listData?.contracts ?? listData ?? [];

        for (const item of Array.isArray(items) ? items : []) {
          contracts.push({
            contractId: String(
              item.noContrat ?? item.contractId ?? "",
            ),
            accountId: String(
              item.noCompteContrat ?? item.accountId ?? "",
            ),
            address: String(
              item.adresse ?? item.address ?? "",
            ),
            meterId: String(
              item.noCompteur ?? item.meterId ?? "",
            ),
            rateCode: String(
              item.codeTarif ?? item.rateCode ?? "",
            ),
          });
        }
      }
    }

    log.info(`Found ${contracts.length} contract(s)`);
    return contracts;
  }

  async getPeriods(
    applicantId: string,
    customerId: string,
    contractId: string,
  ): Promise<HQPeriod[]> {
    log.info(`Fetching periods for contract ${contractId}`);

    await this._selectContract(applicantId, customerId, contractId);

    const response = await this._makeRequest(PERIOD_DATA_URL, "GET", {
      headers: this._getCustomerHeaders(applicantId, customerId),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to fetch periods: ${response.status} — ${text.substring(0, 200)}`,
      );
    }

    const data = await response.json();
    const periods: HQPeriod[] = [];

    const periodList =
      data?.periodesConsommation ??
      data?.periodes ??
      data?.periods ??
      data ??
      [];

    for (const period of Array.isArray(periodList) ? periodList : []) {
      const startDate =
        period.dateDebutPeriode ??
        period.startDate ??
        period.debut ??
        "";
      const endDate =
        period.dateFinPeriode ?? period.endDate ?? period.fin ?? "";

      if (startDate && endDate) {
        periods.push({
          startDate: String(startDate),
          endDate: String(endDate),
          contractId,
        });
      }
    }

    log.info(`Found ${periods.length} period(s) for contract ${contractId}`);
    return periods;
  }

  async downloadCSV(
    applicantId: string,
    customerId: string,
    contractId: string,
    startDate: string,
    endDate: string,
    option: "energie-heure" | "puissance-min",
  ): Promise<string> {
    log.info(
      `Downloading CSV: contract=${contractId}, ${startDate} to ${endDate}, option=${option}`,
    );

    await this._selectContract(applicantId, customerId, contractId);

    const body = JSON.stringify({
      startDate,
      endDate,
      option,
    });

    const response = await this._makeRequest(CONSO_CSV_URL, "POST", {
      headers: this._getCustomerHeaders(applicantId, customerId),
      body,
      contentType: "application/json",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `CSV download failed: ${response.status} — ${text.substring(0, 200)}`,
      );
    }

    const csvContent = await response.text();
    log.info(
      `Downloaded CSV: ${csvContent.split("\n").length} lines, ${csvContent.length} bytes`,
    );
    return csvContent;
  }

  async downloadOverviewCSV(
    applicantId: string,
    customerId: string,
  ): Promise<string> {
    log.info("Downloading consumption overview CSV");

    const response = await this._makeRequest(CONSO_OVERVIEW_CSV_URL, "GET", {
      headers: this._getCustomerHeaders(applicantId, customerId),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Overview CSV download failed: ${response.status} — ${text.substring(0, 200)}`,
      );
    }

    return await response.text();
  }

  async downloadAllData(
    username: string,
    password: string,
  ): Promise<HQDownloadResult[]> {
    const results: HQDownloadResult[] = [];
    const csvOptions: Array<"energie-heure" | "puissance-min"> = [
      "energie-heure",
      "puissance-min",
    ];

    this._reportProgress("login", "Authenticating with Hydro-Québec", 0, 1);
    const loginSuccess = await this.login(username, password);
    if (!loginSuccess) {
      throw new Error(
        "Authentication failed — invalid credentials or account locked",
      );
    }

    this._reportProgress("accounts", "Fetching account information", 0, 1);
    const accounts = await this.getAccounts();
    if (accounts.length === 0) {
      throw new Error("No accounts found for this user");
    }

    let totalContracts = 0;
    let processedContracts = 0;

    const accountContracts: Array<{
      applicantId: string;
      customerId: string;
      contracts: HQContract[];
    }> = [];

    for (const account of accounts) {
      this._reportProgress(
        "contracts",
        `Fetching contracts for account ${account.customerId}`,
        accountContracts.length,
        accounts.length,
      );

      const contracts = await this.getContracts(
        account.applicantId,
        account.customerId,
      );
      totalContracts += contracts.length;
      accountContracts.push({
        ...account,
        contracts,
      });
    }

    this._reportProgress(
      "download",
      `Starting download for ${totalContracts} contract(s)`,
      0,
      totalContracts,
    );

    for (const { applicantId, customerId, contracts } of accountContracts) {
      for (const contract of contracts) {
        processedContracts++;
        this._reportProgress(
          "download",
          `Processing contract ${contract.contractId}`,
          processedContracts,
          totalContracts,
          contract.address || contract.contractId,
        );

        const result: HQDownloadResult = {
          contractId: contract.contractId,
          meterId: contract.meterId,
          address: contract.address,
          csvFiles: [],
        };

        try {
          const periods = await this.getPeriods(
            applicantId,
            customerId,
            contract.contractId,
          );

          let periodIdx = 0;
          for (const period of periods) {
            periodIdx++;
            for (const option of csvOptions) {
              this._reportProgress(
                "download",
                `Downloading ${option} — period ${periodIdx}/${periods.length}`,
                processedContracts,
                totalContracts,
                `${contract.contractId}: ${period.startDate} → ${period.endDate}`,
              );

              try {
                const csvContent = await this.downloadCSV(
                  applicantId,
                  customerId,
                  contract.contractId,
                  period.startDate,
                  period.endDate,
                  option,
                );

                const rowCount = csvContent
                  .split("\n")
                  .filter((line) => line.trim().length > 0).length;

                result.csvFiles.push({
                  option,
                  periodStart: period.startDate,
                  periodEnd: period.endDate,
                  csvContent,
                  rowCount,
                });
              } catch (csvError: unknown) {
                const msg =
                  csvError instanceof Error
                    ? csvError.message
                    : String(csvError);
                log.warn(
                  `Failed to download CSV for ${contract.contractId} (${option}, ${period.startDate}–${period.endDate}): ${msg}`,
                );
              }

              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        } catch (periodError: unknown) {
          const msg =
            periodError instanceof Error
              ? periodError.message
              : String(periodError);
          log.warn(
            `Failed to fetch periods for contract ${contract.contractId}: ${msg}`,
          );
        }

        results.push(result);
      }
    }

    this._reportProgress(
      "complete",
      "Download complete",
      totalContracts,
      totalContracts,
      `${results.length} contract(s), ${results.reduce((sum, r) => sum + r.csvFiles.length, 0)} CSV file(s)`,
    );

    return results;
  }
}

export async function fetchHQData(
  username: string,
  password: string,
  onProgress?: ProgressCallback,
): Promise<HQDownloadResult[]> {
  const fetcher = new HQDataFetcher(onProgress);
  return fetcher.downloadAllData(username, password);
}
