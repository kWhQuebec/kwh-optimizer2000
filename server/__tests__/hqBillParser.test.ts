import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Gemini AI client before imports
vi.mock("../replit_integrations/image/client", () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
}));

import { parseHQBill, parseHQBillFromBuffer, type HQBillData } from "../hqBillParser";
import { ai } from "../replit_integrations/image/client";

const mockGenerateContent = vi.mocked(ai.models.generateContent);

// Helper: build a mock Gemini response
function mockGeminiResponse(jsonData: Record<string, unknown>) {
  return {
    candidates: [{
      content: {
        parts: [{ text: JSON.stringify(jsonData) }],
      },
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── parseHQBill — successful extraction ─────────────────────────────────────

describe("parseHQBill", () => {
  it("extracts all fields from a valid Gemini response", async () => {
    const billData = {
      clientNumber: "108 304 154",
      clientName: "Acme Corp Inc.",
      serviceAddress: "1234 Rue Principale, Montréal QC H1A 2B3",
      billNumber: "123456789012",
      hqAccountNumber: "299 095 411 722",
      contractNumber: "CT-2024-001",
      annualConsumptionKwh: 450000,
      peakDemandKw: 125.5,
      tariffCode: "M",
      tariffDetail: "M avec GDP",
      billingPeriod: "2024-01-15 au 2024-02-14",
      estimatedMonthlyBill: 4567.89,
      confidence: 0.95,
      consumptionHistory: [
        { period: "2024-01 au 2024-02", kWh: 38000, kW: 125.5, amount: 4567.89, days: 31 },
        { period: "2023-12 au 2024-01", kWh: 42000, kW: 130.2, amount: 5012.34, days: 32 },
      ],
    };
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(billData));

    const result = await parseHQBill("base64data", "image/jpeg");

    expect(result.accountNumber).toBe("108 304 154");
    expect(result.clientName).toBe("Acme Corp Inc.");
    expect(result.serviceAddress).toBe("1234 Rue Principale, Montréal QC H1A 2B3");
    expect(result.annualConsumptionKwh).toBe(450000);
    expect(result.peakDemandKw).toBe(125.5);
    expect(result.tariffCode).toBe("M");
    expect(result.tariffDetail).toBe("M avec GDP");
    expect(result.estimatedMonthlyBill).toBe(4567.89);
    expect(result.confidence).toBe(0.95);
    expect(result.consumptionHistory).toHaveLength(2);
    expect(result.consumptionHistory![0].kWh).toBe(38000);
  });

  it("strips base64 data URI prefix", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse({
      clientNumber: "111 222 333",
      confidence: 0.8,
    }));

    await parseHQBill("data:image/jpeg;base64,/9j/4AAQ...", "image/jpeg");

    const call = mockGenerateContent.mock.calls[0];
    const parts = call[0].contents[0].parts;
    expect(parts[0].inlineData.data).toBe("/9j/4AAQ...");
  });

  it("handles no text response from Gemini", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [] } }],
    });

    const result = await parseHQBill("base64data");
    expect(result.confidence).toBe(0);
    expect(result.rawExtraction).toContain("No response");
  });

  it("handles invalid JSON in response", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "This is not JSON" }] } }],
    });

    const result = await parseHQBill("base64data");
    expect(result.confidence).toBe(0);
    expect(result.rawExtraction).toBe("This is not JSON");
  });

  it("handles Gemini API error", async () => {
    mockGenerateContent.mockRejectedValue(new Error("API quota exceeded"));

    const result = await parseHQBill("base64data");
    expect(result.confidence).toBe(0);
    expect(result.rawExtraction).toContain("API quota exceeded");
  });

  it("clamps confidence between 0 and 1", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse({
      clientNumber: "111 222 333",
      clientName: "Test",
      serviceAddress: "123 Test",
      confidence: 1.5,
    }));

    const result = await parseHQBill("base64data");
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("reduces confidence when fewer than 2 fields found", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse({
      confidence: 0.9,
    }));

    const result = await parseHQBill("base64data");
    expect(result.confidence).toBeLessThanOrEqual(0.3);
  });

  it("normalizes field types (non-string as null)", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse({
      clientNumber: 12345,
      clientName: null,
      annualConsumptionKwh: "not a number",
      confidence: 0.7,
    }));

    const result = await parseHQBill("base64data");
    expect(result.accountNumber).toBeNull();
    expect(result.clientName).toBeNull();
    expect(result.annualConsumptionKwh).toBeNull();
  });

  it("handles consumptionHistory with invalid entries", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse({
      clientNumber: "111 222 333",
      clientName: "Test Corp",
      confidence: 0.8,
      consumptionHistory: [
        { period: "2024-01", kWh: "invalid", kW: null, amount: 100, days: 30 },
      ],
    }));

    const result = await parseHQBill("base64data");
    expect(result.consumptionHistory).toHaveLength(1);
    expect(result.consumptionHistory![0].kWh).toBeNull();
    expect(result.consumptionHistory![0].amount).toBe(100);
  });
});

// ─── parseHQBillFromBuffer ───────────────────────────────────────────────────

describe("parseHQBillFromBuffer", () => {
  it("converts buffer to base64 and calls parseHQBill", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse({
      clientNumber: "111 222 333",
      confidence: 0.8,
    }));

    const buffer = Buffer.from("fake image data");
    const result = await parseHQBillFromBuffer(buffer, "image/png");

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.accountNumber).toBe("111 222 333");
  });
});
