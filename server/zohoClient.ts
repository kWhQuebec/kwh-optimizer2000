/**
 * Zoho CRM API Client
 * 
 * Handles OAuth2 authentication with automatic token refresh
 * and CRUD operations for Leads, Deals, and Accounts.
 */

interface ZohoConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  baseUrl: string;
}

interface ZohoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZohoRecord {
  id?: string;
  [key: string]: any;
}

interface ZohoApiResponse {
  data?: Array<{ 
    code: string; 
    details: { id: string };
    message: string;
    status: string;
  }>;
  info?: { more_records: boolean };
}

export interface ZohoResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  isMock?: boolean;
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

function getZohoConfig(): ZohoConfig | null {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const baseUrl = process.env.ZOHO_BASE_URL || "https://www.zohoapis.com";

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return { clientId, clientSecret, refreshToken, baseUrl };
}

async function getAccessToken(): Promise<string | null> {
  const config = getZohoConfig();
  if (!config) {
    console.log("[Zoho] No Zoho credentials configured - operating in mock mode");
    return null;
  }

  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  try {
    const tokenUrl = `https://accounts.zoho.com/oauth/v2/token`;
    const params = new URLSearchParams({
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Zoho] Token refresh failed:", errorText);
      return null;
    }

    const data: ZohoTokenResponse = await response.json();
    cachedAccessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    
    console.log("[Zoho] Access token refreshed successfully");
    return cachedAccessToken;
  } catch (error) {
    console.error("[Zoho] Token refresh error:", error);
    return null;
  }
}

async function zohoApiRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: any
): Promise<ZohoApiResponse | null> {
  const config = getZohoConfig();
  if (!config) {
    return null;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null;
  }

  try {
    const url = `${config.baseUrl}/crm/v3/${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        "Authorization": `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Zoho] API error (${response.status}):`, errorText);
      return null;
    }

    const data: ZohoApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[Zoho] API request error:", error);
    return null;
  }
}

export interface LeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  description?: string;
  source?: string;
  streetAddress?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

export interface LeadUpdateData {
  stage?: string;
  description?: string;
  roofAreaSqM?: number;
  roofPotentialKw?: number;
  customFields?: Record<string, any>;
}

export interface TaskData {
  subject: string;
  dueDate: string;
  priority?: "High" | "Highest" | "Low" | "Lowest" | "Normal";
  status?: "Not Started" | "Deferred" | "In Progress" | "Completed" | "Waiting for input";
  description?: string;
  relatedTo?: { module: "Leads" | "Accounts" | "Deals"; id: string };
}

export interface DealData {
  dealName: string;
  accountName?: string;
  amount?: number;
  stage?: string;
  description?: string;
  closingDate?: string;
  customFields?: Record<string, any>;
}

export interface AccountData {
  accountName: string;
  website?: string;
  phone?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingCountry?: string;
}

/**
 * Check if Zoho integration is configured
 */
export function isZohoConfigured(): boolean {
  return getZohoConfig() !== null;
}

/**
 * Create a Lead in Zoho CRM from a web form submission
 */
export async function createLead(leadData: LeadData): Promise<ZohoResult<string>> {
  const config = getZohoConfig();
  
  if (!config) {
    // Mock mode - return fake ID
    console.log("[Zoho Mock] Would create lead:", leadData);
    return { success: true, data: `MOCK_LEAD_${Date.now()}`, isMock: true };
  }

  // Validate required fields for Zoho
  const lastName = leadData.lastName?.trim() || "-";
  const company = leadData.company?.trim() || "Non spécifié";

  const zohoLead: ZohoRecord = {
    First_Name: leadData.firstName?.trim() || "",
    Last_Name: lastName,
    Email: leadData.email,
    Phone: leadData.phone || null,
    Company: company,
    Description: leadData.description || null,
    Lead_Source: leadData.source || "Website",
    Street: leadData.streetAddress || null,
    City: leadData.city || null,
    State: leadData.province || "Québec",
    Zip_Code: leadData.postalCode || null,
    Country: "Canada",
  };

  const response = await zohoApiRequest("POST", "Leads", {
    data: [zohoLead],
  });

  if (response?.data?.[0]?.details?.id) {
    console.log("[Zoho] Lead created:", response.data[0].details.id);
    return { success: true, data: response.data[0].details.id };
  }

  const errorMsg = response?.data?.[0]?.message || "Unknown error creating lead";
  console.error("[Zoho] Failed to create lead:", errorMsg);
  return { success: false, error: errorMsg };
}

/**
 * Update an existing Lead in Zoho CRM
 * Note: Lead_Status values must match those configured in Zoho CRM picklist
 * Standard Zoho lead statuses: "Not Contacted", "Contacted", "Contact in Future", etc.
 */
export async function updateLead(leadId: string, updateData: LeadUpdateData): Promise<ZohoResult<boolean>> {
  const config = getZohoConfig();
  
  if (!config || leadId.startsWith("MOCK_")) {
    console.log("[Zoho Mock] Would update lead:", leadId, updateData);
    return { success: true, data: true, isMock: true };
  }

  const zohoLead: ZohoRecord = {
    id: leadId,
  };

  if (updateData.stage) zohoLead.Lead_Status = updateData.stage;
  if (updateData.description) zohoLead.Description = updateData.description;
  if (updateData.customFields) Object.assign(zohoLead, updateData.customFields);

  const response = await zohoApiRequest("PUT", "Leads", {
    data: [zohoLead],
  });

  if (response?.data?.[0]?.code === "SUCCESS") {
    console.log("[Zoho] Lead updated:", leadId);
    return { success: true, data: true };
  }

  const errorMsg = response?.data?.[0]?.message || "Unknown error updating lead";
  console.error("[Zoho] Failed to update lead:", errorMsg);
  return { success: false, error: errorMsg };
}

/**
 * Create a follow-up Task in Zoho CRM
 */
export async function createTask(taskData: TaskData): Promise<ZohoResult<string>> {
  const config = getZohoConfig();
  
  if (!config) {
    console.log("[Zoho Mock] Would create task:", taskData);
    return { success: true, data: `MOCK_TASK_${Date.now()}`, isMock: true };
  }

  const zohoTask: ZohoRecord = {
    Subject: taskData.subject,
    Due_Date: taskData.dueDate,
    Priority: taskData.priority || "Normal",
    Status: taskData.status || "Not Started",
    Description: taskData.description || null,
  };

  if (taskData.relatedTo && !taskData.relatedTo.id.startsWith("MOCK_")) {
    zohoTask.$se_module = taskData.relatedTo.module;
    zohoTask.What_Id = { id: taskData.relatedTo.id };
  }

  const response = await zohoApiRequest("POST", "Tasks", {
    data: [zohoTask],
  });

  if (response?.data?.[0]?.details?.id) {
    console.log("[Zoho] Task created:", response.data[0].details.id);
    return { success: true, data: response.data[0].details.id };
  }

  const errorMsg = response?.data?.[0]?.message || "Unknown error creating task";
  console.error("[Zoho] Failed to create task:", errorMsg);
  return { success: false, error: errorMsg };
}

/**
 * Create an Account in Zoho CRM
 */
export async function createAccount(accountData: AccountData): Promise<ZohoResult<string>> {
  const config = getZohoConfig();
  
  if (!config) {
    console.log("[Zoho Mock] Would create account:", accountData);
    return { success: true, data: `MOCK_ACCOUNT_${Date.now()}`, isMock: true };
  }

  const zohoAccount: ZohoRecord = {
    Account_Name: accountData.accountName || "Unknown Account",
    Website: accountData.website || null,
    Phone: accountData.phone || null,
    Billing_Street: accountData.billingAddress || null,
    Billing_City: accountData.billingCity || null,
    Billing_State: accountData.billingState || null,
    Billing_Country: accountData.billingCountry || "Canada",
  };

  const response = await zohoApiRequest("POST", "Accounts", {
    data: [zohoAccount],
  });

  if (response?.data?.[0]?.details?.id) {
    console.log("[Zoho] Account created:", response.data[0].details.id);
    return { success: true, data: response.data[0].details.id };
  }

  const errorMsg = response?.data?.[0]?.message || "Unknown error creating account";
  console.error("[Zoho] Failed to create account:", errorMsg);
  return { success: false, error: errorMsg };
}

/**
 * Create a Deal/Opportunity in Zoho CRM from a system design
 */
export async function createDeal(dealData: DealData, accountId?: string): Promise<ZohoResult<string>> {
  const config = getZohoConfig();
  
  if (!config) {
    console.log("[Zoho Mock] Would create deal:", dealData);
    return { success: true, data: `MOCK_DEAL_${Date.now()}`, isMock: true };
  }

  const zohoDeal: ZohoRecord = {
    Deal_Name: dealData.dealName || "Solar + Storage System",
    Amount: dealData.amount || 0,
    Stage: dealData.stage || "Qualification",
    Description: dealData.description || null,
    Closing_Date: dealData.closingDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  };

  // Link to account if provided
  if (accountId && !accountId.startsWith("MOCK_")) {
    zohoDeal.Account_Name = { id: accountId };
  }

  // Add custom fields for solar project details
  if (dealData.customFields) {
    Object.assign(zohoDeal, dealData.customFields);
  }

  const response = await zohoApiRequest("POST", "Deals", {
    data: [zohoDeal],
  });

  if (response?.data?.[0]?.details?.id) {
    console.log("[Zoho] Deal created:", response.data[0].details.id);
    return { success: true, data: response.data[0].details.id };
  }

  const errorMsg = response?.data?.[0]?.message || "Unknown error creating deal";
  console.error("[Zoho] Failed to create deal:", errorMsg);
  return { success: false, error: errorMsg };
}

/**
 * Update an existing Deal in Zoho CRM
 */
export async function updateDeal(dealId: string, dealData: Partial<DealData>): Promise<ZohoResult<boolean>> {
  const config = getZohoConfig();
  
  // Handle mock IDs
  if (!config || dealId.startsWith("MOCK_")) {
    console.log("[Zoho Mock] Would update deal:", dealId, dealData);
    return { success: true, data: true, isMock: true };
  }

  const zohoDeal: ZohoRecord = {
    id: dealId,
  };

  if (dealData.dealName) zohoDeal.Deal_Name = dealData.dealName;
  if (dealData.amount !== undefined) zohoDeal.Amount = dealData.amount;
  if (dealData.stage) zohoDeal.Stage = dealData.stage;
  if (dealData.description) zohoDeal.Description = dealData.description;
  if (dealData.customFields) Object.assign(zohoDeal, dealData.customFields);

  const response = await zohoApiRequest("PUT", "Deals", {
    data: [zohoDeal],
  });

  if (response?.data?.[0]?.code === "SUCCESS") {
    console.log("[Zoho] Deal updated:", dealId);
    return { success: true, data: true };
  }

  const errorMsg = response?.data?.[0]?.message || "Unknown error updating deal";
  console.error("[Zoho] Failed to update deal:", errorMsg);
  return { success: false, error: errorMsg };
}

/**
 * Add a note to a record (Lead, Account, or Deal)
 */
export async function addNote(
  parentModule: "Leads" | "Accounts" | "Deals",
  parentId: string,
  noteContent: string
): Promise<boolean> {
  const config = getZohoConfig();
  
  if (!config) {
    console.log("[Zoho Mock] Would add note to", parentModule, parentId, ":", noteContent);
    return true;
  }

  const response = await zohoApiRequest("POST", "Notes", {
    data: [{
      Parent_Id: { module: { api_name: parentModule }, id: parentId },
      Note_Title: "kWh Québec Update",
      Note_Content: noteContent,
    }],
  });

  if (response?.data?.[0]?.code === "SUCCESS") {
    console.log("[Zoho] Note added to", parentModule, parentId);
    return true;
  }

  console.error("[Zoho] Failed to add note:", response);
  return false;
}

/**
 * Get a Lead by ID
 */
export async function getLead(leadId: string): Promise<ZohoRecord | null> {
  const config = getZohoConfig();
  
  if (!config) {
    console.log("[Zoho Mock] Would get lead:", leadId);
    return null;
  }

  const response = await zohoApiRequest("GET", `Leads/${leadId}`);
  return response?.data?.[0] || null;
}

/**
 * Get a Deal by ID
 */
export async function getDeal(dealId: string): Promise<ZohoRecord | null> {
  const config = getZohoConfig();
  
  if (!config) {
    console.log("[Zoho Mock] Would get deal:", dealId);
    return null;
  }

  const response = await zohoApiRequest("GET", `Deals/${dealId}`);
  return response?.data?.[0] || null;
}
