/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

import serverWidget = require("N/ui/serverWidget");
import https = require("N/https");
import search = require("N/search");
import log = require("N/log");
import runtime = require("N/runtime");

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
// GEMINI_API_KEY: prefer env var, then globalThis, then NetSuite script parameter.
// Keep as a const so compiled JS sees a single value at module load time.
const GEMINI_API_KEY: string = getGeminiApiKey();

let _currentInvoices: any[] | null = null;
let _currentRecordCount = 0;

export function onRequest(ctx: any) {
  if (ctx.request && ctx.request.method === "POST" && ctx.request.body) {
    let body: any = null;
    try {
      body =
        typeof ctx.request.body === "string"
          ? JSON.parse(ctx.request.body)
          : ctx.request.body || {};
    } catch (e) {
      ctx.response.write(
        JSON.stringify(createErrorResponse("Invalid JSON in request body"))
      );
      return;
    }
    const customerId = body && body.customerId;
    if (!customerId) {
      ctx.response.write(
        JSON.stringify(createErrorResponse("Customer ID is required"))
      );
      return;
    }
    try {
      log.debug({
        title: "AI Analysis",
        details: "Analyzing customer: " + customerId,
      });
      const searchRes = runInvoiceSearch(customerId, 20);
      log.debug({
        title: "Database Search",
        details: "Found " + searchRes.count + " invoices for " + customerId,
      });
      const aiText = callGeminiForAnalysis(searchRes.invoices);
      ctx.response.write(
        JSON.stringify(createSuccessResponse(searchRes, aiText))
      );
    } catch (err) {
      log.error({ title: "AI analyze error", details: String(err) });
      ctx.response.write(JSON.stringify(createErrorResponse(err)));
    }
    return;
  }
  const form = buildForm();
  ctx.response.writePage(form);
}

function invoiceRowHandler(row: any) {
  if (!_currentInvoices) return false;
  _currentRecordCount++;
  _currentInvoices.push({
    tranid: row.getValue("tranid"),
    total: +row.getValue("total"),
    duedate: row.getValue("duedate"),
    status: row.getValue("status"),
  });
  return _currentInvoices.length < 20;
}

function safeParseJson(text: string | null): any {
  if (!text) return null;
  try {
    return JSON.parse(text as string);
  } catch (e) {
    const m = (text as string).match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

function runInvoiceSearch(customerId: string | number, cap?: number) {
  cap = cap || 20;
  const invoices: any[] = [];
  _currentInvoices = invoices;
  _currentRecordCount = 0;
  try {
    const invoiceSearch = search.create({
      type: "invoice",
      filters: [["entity", "anyof", customerId]],
      columns: ["tranid", "total", "duedate", "status"],
    });
    const rs = invoiceSearch.run();
    if (rs && typeof (rs as any).each === "function") {
      (rs as any).each(invoiceRowHandler);
    }
  } catch (err) {
    log.error({
      title: "Invoice Search Error",
      details: JSON.stringify(err),
    });
  }
  const count = _currentRecordCount || invoices.length;
  _currentInvoices = null;
  _currentRecordCount = 0;

  function parseAmount(v: any) {
    if (v == null) return 0;
    const s = String(v).replace(/[^0-9.\-]/g, "");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  const outstandingAmount = invoices.reduce((sum, inv) => {
    const st = inv && inv.status ? String(inv.status).toLowerCase() : "";
    if (st.indexOf("paid") !== -1) return sum;
    return sum + parseAmount(inv.total);
  }, 0);

  try {
    log.debug({
      title: "OutstandingCalc",
      details:
        "invoices:" +
        JSON.stringify(invoices) +
        ", outstanding:" +
        outstandingAmount,
    });
  } catch (e) {}

  return {
    invoices,
    count,
    outstandingAmount,
  };
}

function callGeminiForAnalysis(invoices: any[]) {
  const payload = {
    contents: [
      {
        parts: [
          {
            text:
              "Analyze AR risk and payment behavior for customer with " +
              invoices.length +
              " invoices: " +
              JSON.stringify(invoices) +
              '.\n\nIMPORTANT: Return ONLY a valid JSON object with exactly these properties:\n{\n  "riskLevel": "High" | "Medium" | "Low",\n  "summary": "Your detailed analysis of the customer\'s payment behavior and AR risk",\n  "recommendedEmail": "A short recommended email to send to the customer based on their risk level"\n}\n\nThe recommendedEmail should be concise (2-6 sentences) and tailored to the customer\'s risk level. Do not include any markdown formatting, code blocks, or additional text. Return only the JSON object.',
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  const resp = https.post({
    url: GEMINI_URL,
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!resp || resp.code >= 400)
    throw new Error(
      "AI call failed: " + (resp && resp.code) + " " + (resp && resp.body)
    );
  const gem = safeParseJson(resp.body);
  let aiText = "";
  if (
    gem &&
    gem.candidates &&
    gem.candidates[0] &&
    gem.candidates[0].content &&
    gem.candidates[0].content.parts &&
    gem.candidates[0].content.parts[0]
  ) {
    aiText = gem.candidates[0].content.parts[0].text || "";
  }
  return aiText;
}

function buildForm() {
  const form = serverWidget.createForm({
    title: "NS Customer AR Risk Assessment",
  });
  form.addField({
    id: "custpage_customer",
    type: serverWidget.FieldType.SELECT,
    label: "Customer",
    source: "customer",
  });
  const resultField = form.addField({
    id: "custpage_result",
    type: serverWidget.FieldType.INLINEHTML,
    label: "AI Analysis Result",
  });
  form.clientScriptModulePath = "./cl_ai_customer_analyzer.js";
  resultField.defaultValue =
    '<div id="analysis-result" class="ns-panel" style="min-height:100px;"><h3 class="ns-heading">AI Analysis Result</h3><div class="ns-muted">Select a customer and click <strong>Analyze with AI</strong> to begin analysis...</div></div>';
  form.addField({
    id: "custpage_button_container",
    type: serverWidget.FieldType.INLINEHTML,
    label: " ",
  }).defaultValue =
    '<style>h1, .ns-form-title { font-size: 26px !important; margin-bottom: 8px !important; } body, .ns-panel, select, .ns-toolbar { font-size: 15px; } .ns-panel{border:1px solid #e6e6e6;background:#ffffff;padding:12px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;margin-bottom:8px} .ns-heading{font-size:14px;font-weight:200;color:#333;margin:0 0 6px 0} .ns-muted{color:#333;font-size:13px} .ns-toolbar{margin-top:8px} .ns-btn{display:inline-block;padding:8px 14px;border-radius:3px;border:1px solid #bfbfbf;background:#f5f5f5;color:#222;cursor:pointer;font-size:14px} .ns-btn.primary{background:#004680;color:#fff;border-color:#00385a} .ns-btn[disabled]{opacity:0.65;cursor:not-allowed} .ns-badge{display:inline-block;padding:3px 8px;border-radius:12px;background:#eef6ff;color:#005fa3;font-size:12px;margin-left:6px} .ns-badge.low{background:#e6f4ea;color:#166534;border:1px solid #c7ebd0} .ns-badge.medium{background:#fff7e6;color:#8a5800;border:1px solid #ffecbf} .ns-badge.high{background:#fdecea;color:#7a1f18;border:1px solid #f7c6c0}</style><div class="ns-toolbar"><button id="analyze-btn" class="ns-btn primary" type="button">Analyze with AI</button></div>';
  return form;
}

function createSuccessResponse(searchRes: any, aiText: string) {
  return {
    success: true,
    invoiceCount:
      (searchRes && searchRes.count) ||
      (searchRes && searchRes.invoices && searchRes.invoices.length) ||
      0,
    outstandingAmount: (searchRes && searchRes.outstandingAmount) || 0,
    result: aiText,
  };
}

function createErrorResponse(err: any) {
  return { success: false, error: String(err && (err.message || err)) };
}

// Helper to source Gemini API key from environment, globalThis, or NetSuite script
function getGeminiApiKey(): string {
  try {
    if (
      typeof process !== "undefined" &&
      process.env &&
      process.env.GEMINI_API_KEY
    ) {
      return process.env.GEMINI_API_KEY as string;
    }
  } catch (e) {}

  try {
    if (
      typeof globalThis !== "undefined" &&
      (globalThis as any).GEMINI_API_KEY
    ) {
      return (globalThis as any).GEMINI_API_KEY;
    }
  } catch (e) {}

  try {
    const s =
      (runtime as any).getCurrentScript && (runtime as any).getCurrentScript();
    if (s && typeof s.getParameter === "function") {
      return (
        s.getParameter("custscript_gemini_api_key") ||
        s.getParameter({ name: "custscript_gemini_api_key" } as any) ||
        ""
      );
    }
  } catch (e) {}

  return "";
}
