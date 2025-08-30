/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NScriptName Customer Payment Analytics
 * @NScriptId customscript_payment_analytics
 */

import serverWidget = require("N/ui/serverWidget");
import search = require("N/search");
import log = require("N/log");

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

    const action = body.action;
    const customerId = body.customerId;

    if (action === "getPaymentAnalytics" && customerId) {
      try {
        log.debug({
          title: "Payment Analytics",
          details: "Analyzing payment performance for customer: " + customerId,
        });
        const analytics = getPaymentAnalytics(customerId);
        ctx.response.write(JSON.stringify(createSuccessResponse(analytics)));
      } catch (err) {
        log.error({ title: "Payment analytics error", details: String(err) });
        ctx.response.write(JSON.stringify(createErrorResponse(err)));
      }
      return;
    } else if (action === "getTopRiskCustomers") {
      try {
        const riskCustomers = getTopRiskCustomers();
        ctx.response.write(
          JSON.stringify(createSuccessResponse({ riskCustomers }))
        );
      } catch (err) {
        log.error({ title: "Risk analysis error", details: String(err) });
        ctx.response.write(JSON.stringify(createErrorResponse(err)));
      }
      return;
    } else if (action === "getCashFlowForecast") {
      try {
        const forecast = getCashFlowForecast();
        ctx.response.write(JSON.stringify(createSuccessResponse({ forecast })));
      } catch (err) {
        log.error({ title: "Cash flow forecast error", details: String(err) });
        ctx.response.write(JSON.stringify(createErrorResponse(err)));
      }
      return;
    }

    ctx.response.write(
      JSON.stringify(createErrorResponse("Invalid request parameters"))
    );
    return;
  }

  const form = buildForm();
  ctx.response.writePage(form);
}

function getPaymentAnalytics(customerId: string | number): any {
  try {
    const customer = getCustomerInfo(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const invoices = getCustomerInvoices(customerId);
    const paymentScore = calculatePaymentScore(invoices.invoices);
    const riskAssessment = calculateRiskFactors(customer, invoices.invoices);
    const recommendations = generateRecommendations(
      paymentScore,
      riskAssessment
    );

    return {
      customer,
      invoices: invoices.invoices,
      totalInvoices: invoices.count,
      totalOutstanding: invoices.totalAmount,
      paymentScore,
      riskAssessment,
      recommendations,
    };
  } catch (error) {
    log.error({
      title: "Error getting payment analytics",
      details: String(error),
    });
    throw error;
  }
}

function getCustomerInfo(customerId: string | number): any {
  try {
    const customerSearch = search.create({
      type: "customer",
      filters: [["internalid", "anyof", customerId]],
      columns: [
        "internalid",
        "entityid",
        "companyname",
        "email",
        "phone",
        "balance",
        "creditlimit",
        "datecreated",
        "salesrep",
        "terms",
      ],
    });

    let customerData: any = null;
    const rs = customerSearch.run();
    if (rs && typeof rs.each === "function") {
      rs.each((result) => {
        customerData = {
          id: result.getValue("internalid"),
          entityid: result.getValue("entityid"),
          companyname: result.getValue("companyname"),
          email: result.getValue("email"),
          phone: result.getValue("phone"),
          balance: parseFloat(result.getValue("balance") as string) || 0,
          creditlimit:
            parseFloat(result.getValue("creditlimit") as string) || 0,
          datecreated: result.getValue("datecreated"),
          salesrep: result.getValue("salesrep"),
          terms: result.getValue("terms"),
        };
        return false;
      });
    }

    return customerData;
  } catch (error) {
    log.error({
      title: "Error getting customer info",
      details: String(error),
    });
    throw error;
  }
}

function getCustomerInvoices(customerId: string | number): {
  invoices: any[];
  count: number;
  totalAmount: number;
} {
  try {
    const invoiceSearch = search.create({
      type: "invoice",
      filters: [["entity", "anyof", customerId]],
      columns: ["tranid", "total", "duedate", "trandate", "status", "terms"],
    });

    const invoices: any[] = [];
    let totalAmount = 0;
    let count = 0;

    const rs = invoiceSearch.run();
    if (rs && typeof rs.each === "function") {
      rs.each((result) => {
        const invoice = {
          tranid: result.getValue("tranid"),
          total: parseFloat(result.getValue("total") as string) || 0,
          duedate: result.getValue("duedate"),
          trandate: result.getValue("trandate"),
          status: result.getValue("status"),
          terms: result.getValue("terms"),
        };

        invoices.push(invoice);
        if (invoice.status !== "Paid") {
          totalAmount += invoice.total;
        }
        count++;

        return count < 100;
      });
    }

    return { invoices, count, totalAmount };
  } catch (error) {
    log.error({
      title: "Error getting customer invoices",
      details: String(error),
    });
    throw error;
  }
}

function calculatePaymentScore(invoices: any[]): any {
  if (!invoices || invoices.length === 0) {
    return {
      score: 50,
      grade: "C",
      factors: { insufficient_data: true },
    };
  }

  let score = 100;
  const factors: any = {};

  // Calculate overdue rate
  const today = new Date();
  const overdueInvoices = invoices.filter((inv) => {
    if (!inv.duedate || inv.status === "Paid") return false;
    const dueDate = new Date(inv.duedate);
    return today > dueDate;
  });

  const overdueRate = overdueInvoices.length / invoices.length;
  factors.overdue_rate = Math.round(overdueRate * 100);
  score -= overdueRate * 40;

  // Calculate outstanding amount impact
  const totalOutstanding = invoices
    .filter((inv) => inv.status !== "Paid")
    .reduce((sum, inv) => sum + inv.total, 0);

  factors.outstanding_amount = totalOutstanding;

  if (totalOutstanding > 50000) score -= 20;
  else if (totalOutstanding > 25000) score -= 15;
  else if (totalOutstanding > 10000) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let grade = "F";
  if (score >= 90) grade = "A+";
  else if (score >= 85) grade = "A";
  else if (score >= 80) grade = "A-";
  else if (score >= 75) grade = "B+";
  else if (score >= 70) grade = "B";
  else if (score >= 65) grade = "B-";
  else if (score >= 60) grade = "C+";
  else if (score >= 55) grade = "C";
  else if (score >= 50) grade = "C-";
  else if (score >= 40) grade = "D";

  return { score: Math.round(score), grade, factors };
}

function calculateRiskFactors(customer: any, invoices: any[]): any {
  const risk: any = {
    score: 0,
    level: "Low",
    factors: [],
  };

  // High balance relative to credit limit
  if (customer.balance > customer.creditlimit * 0.8) {
    risk.score += 25;
    risk.factors.push("High balance relative to credit limit");
  }

  // Multiple overdue invoices
  const today = new Date();
  const overdueCount = invoices.filter((inv) => {
    if (!inv.duedate || inv.status === "Paid") return false;
    const dueDate = new Date(inv.duedate);
    return today > dueDate;
  }).length;

  if (overdueCount > 3) {
    risk.score += 20;
    risk.factors.push(`${overdueCount} overdue invoices`);
  }

  // Large outstanding amount
  const totalOutstanding = invoices
    .filter((inv) => inv.status !== "Paid")
    .reduce((sum, inv) => sum + inv.total, 0);

  if (totalOutstanding > 25000) {
    risk.score += 20;
    risk.factors.push("High outstanding amount");
  }

  // Determine risk level
  if (risk.score >= 60) risk.level = "Critical";
  else if (risk.score >= 40) risk.level = "High";
  else if (risk.score >= 20) risk.level = "Medium";
  else risk.level = "Low";

  return risk;
}

function generateRecommendations(
  paymentScore: any,
  riskAssessment: any
): string[] {
  const recommendations: string[] = [];

  if (paymentScore.score < 60) {
    recommendations.push("Consider requiring prepayment or COD");
    recommendations.push("Implement weekly payment reminders");
  }

  if (riskAssessment.level === "Critical" || riskAssessment.level === "High") {
    recommendations.push("Place account on credit hold");
    recommendations.push("Escalate to collections team");
  }

  if (paymentScore.factors.overdue_rate > 30) {
    recommendations.push("Reduce payment terms to Net 15");
    recommendations.push("Offer early payment discount");
  }

  if (recommendations.length === 0) {
    recommendations.push("Customer shows good payment behavior");
    recommendations.push("Consider extending credit terms");
  }

  return recommendations;
}

function getTopRiskCustomers(): any[] {
  try {
    const customerSearch = search.create({
      type: "customer",
      filters: [["balance", "greaterthan", "5000"]],
      columns: [
        "internalid",
        "entityid",
        "companyname",
        "email",
        "balance",
        "creditlimit",
      ],
    });

    const customers: any[] = [];
    let count = 0;

    const rs = customerSearch.run();
    if (rs && typeof rs.each === "function") {
      rs.each((result) => {
        const balance = parseFloat(result.getValue("balance") as string) || 0;
        const creditlimit =
          parseFloat(result.getValue("creditlimit") as string) || 0;

        // Calculate risk score
        let riskScore = 0;
        if (balance > creditlimit * 0.9) riskScore += 40;
        else if (balance > creditlimit * 0.7) riskScore += 25;

        if (balance > 25000) riskScore += 30;
        else if (balance > 10000) riskScore += 15;

        if (riskScore > 20) {
          // Only include risky customers
          customers.push({
            id: result.getValue("internalid"),
            entityid: result.getValue("entityid"),
            companyname: result.getValue("companyname"),
            email: result.getValue("email"),
            balance: balance,
            creditlimit: creditlimit,
            riskScore: riskScore,
            utilizationPercent:
              creditlimit > 0 ? Math.round((balance / creditlimit) * 100) : 0,
          });
        }

        count++;
        return count < 100;
      });
    }

    return customers.sort((a, b) => b.riskScore - a.riskScore).slice(0, 15);
  } catch (error) {
    log.error({
      title: "Error getting top risk customers",
      details: String(error),
    });
    throw error;
  }
}

function getCashFlowForecast(): any {
  try {
    const invoiceSearch = search.create({
      type: "invoice",
      filters: [["status", "anyof", ["Open", "Overdue"]]],
      columns: ["total", "duedate", "status"],
    });

    const forecast: any = {
      next_7_days: 0,
      next_30_days: 0,
      next_60_days: 0,
      next_90_days: 0,
      overdue: 0,
    };

    const today = new Date();
    const rs = invoiceSearch.run();

    if (rs && typeof rs.each === "function") {
      rs.each((result) => {
        const total = parseFloat(result.getValue("total") as string) || 0;
        const dueDateStr = result.getValue("duedate") as string;

        if (!dueDateStr) return true;

        const dueDate = new Date(dueDateStr);
        const daysDiff = Math.floor(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff < 0) {
          forecast.overdue += total;
        } else if (daysDiff <= 7) {
          forecast.next_7_days += total;
        } else if (daysDiff <= 30) {
          forecast.next_30_days += total;
        } else if (daysDiff <= 60) {
          forecast.next_60_days += total;
        } else if (daysDiff <= 90) {
          forecast.next_90_days += total;
        }

        return true;
      });
    }

    return forecast;
  } catch (error) {
    log.error({
      title: "Error getting cash flow forecast",
      details: String(error),
    });
    throw error;
  }
}

function buildForm() {
  const form = serverWidget.createForm({
    title: "🎯 Payment Analytics Dashboard",
  });

  form.addField({
    id: "custpage_customer",
    type: serverWidget.FieldType.SELECT,
    label: "Select Customer for Detailed Analysis",
    source: "customer",
  });

  // Add button toolbar right after customer selection
  form.addField({
    id: "custpage_button_container",
    type: serverWidget.FieldType.INLINEHTML,
    label: " ",
  }).defaultValue = `
    <div class="ns-toolbar">
      <button id="analyze-customer-btn" class="ns-btn primary" type="button">
        Analyze Customer Performance
      </button>
      <button id="risk-analysis-btn" class="ns-btn secondary" type="button">
        View High Risk Customers
      </button>
      <button id="cash-flow-btn" class="ns-btn success" type="button">
        Cash Flow Forecast
      </button>
    </div>`;

  const resultField = form.addField({
    id: "custpage_result",
    type: serverWidget.FieldType.INLINEHTML,
    label: "Analytics Results",
  });

  form.clientScriptModulePath = "./cl_payment_analytics.js";

  resultField.defaultValue = `
    <style>
      /* NetSuite-friendly styling */
      .ns-dashboard { 
        font-family: Tahoma, Arial, Helvetica, sans-serif; 
        font-size: 11px; 
        color: #333; 
        background: #fff;
      }
      
      .ns-welcome-section {
        background: #f7f8f9;
        border: 1px solid #d4d5d6;
        border-radius: 3px;
        padding: 20px;
        margin: 10px 0;
      }
      
      .ns-section-header {
        text-align: center;
        margin-bottom: 20px;
        border-bottom: 1px solid #e0e1e2;
        padding-bottom: 15px;
      }
      
      .ns-section-title {
        font-size: 16px;
        font-weight: bold;
        color: #003d82;
        margin: 0 0 5px 0;
      }
      
      .ns-section-subtitle {
        font-size: 11px;
        color: #666;
      }
      
      .ns-feature-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 15px;
        margin: 20px 0;
      }
      
      .ns-feature-card {
        background: #fff;
        border: 1px solid #d4d5d6;
        border-radius: 3px;
        padding: 15px;
        text-align: center;
        transition: box-shadow 0.2s;
      }
      
      .ns-feature-card:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .ns-feature-icon {
        font-size: 24px;
        margin-bottom: 8px;
      }
      
      .ns-feature-card h4 {
        font-size: 12px;
        font-weight: bold;
        color: #003d82;
        margin: 8px 0 6px 0;
      }
      
      .ns-feature-card p {
        font-size: 10px;
        color: #666;
        line-height: 1.4;
        margin: 0;
      }
      
      .ns-instructions {
        background: #fff;
        border: 1px solid #d4d5d6;
        border-radius: 3px;
        padding: 12px;
        text-align: center;
        font-size: 11px;
        color: #333;
      }
      
      /* Panel Styles */
      .ns-panel { 
        background: #fff;
        border: 1px solid #d4d5d6;
        border-radius: 3px;
        margin: 10px 0;
        padding: 0;
      }
      
      .ns-panel-header {
        background: #f0f1f2;
        border-bottom: 1px solid #d4d5d6;
        padding: 12px 15px;
        font-weight: bold;
        font-size: 12px;
        color: #003d82;
      }
      
      .ns-panel-body {
        padding: 15px;
      }
      
      /* Metrics Grid */
      .ns-metrics-grid { 
        display: grid; 
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
        gap: 15px; 
        margin: 15px 0; 
      }
      
      .ns-metric-card { 
        background: #f7f8f9; 
        border: 1px solid #e0e1e2; 
        border-radius: 3px;
        padding: 15px; 
        text-align: center;
      }
      
      .ns-metric-value { 
        font-size: 20px; 
        font-weight: bold; 
        color: #003d82; 
        margin: 5px 0;
      }
      
      .ns-metric-label { 
        font-size: 10px; 
        color: #666; 
        text-transform: uppercase; 
        margin-bottom: 5px;
        font-weight: bold;
      }
      
      .ns-metric-subtitle {
        font-size: 10px;
        color: #999;
      }
      
      /* Score Badges */
      .ns-score-badge { 
        display: inline-block; 
        padding: 4px 8px; 
        border-radius: 2px; 
        font-weight: bold; 
        font-size: 11px; 
      }
      
      .ns-score-a { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
      .ns-score-b { background: #cce7ff; color: #004085; border: 1px solid #b3d9ff; }
      .ns-score-c { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
      .ns-score-d, .ns-score-f { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
      
      /* Risk Indicators */
      .ns-risk-low { color: #28a745; font-weight: bold; }
      .ns-risk-medium { color: #fd7e14; font-weight: bold; }
      .ns-risk-high { color: #dc3545; font-weight: bold; }
      .ns-risk-critical { color: #721c24; font-weight: bold; background: #f8d7da; padding: 2px 4px; border-radius: 2px; }
      
      /* Tables */
      .ns-table { 
        width: 100%; 
        border-collapse: collapse; 
        font-size: 11px;
        margin: 10px 0;
      }
      
      .ns-table th { 
        background: #f0f1f2; 
        border: 1px solid #d4d5d6; 
        padding: 8px; 
        font-weight: bold; 
        text-align: left;
        color: #003d82;
        font-size: 11px;
      }
      
      .ns-table td { 
        border: 1px solid #d4d5d6; 
        padding: 8px; 
        vertical-align: top;
      }
      
      .ns-table tr:nth-child(even) { 
        background: #f7f8f9; 
      }
      
      .ns-table tr:hover {
        background: #e8f4fd;
      }
      
      /* Buttons */
      .ns-toolbar { 
        background: #f0f1f2;
        border: 1px solid #d4d5d6;
        border-radius: 3px;
        padding: 12px; 
        margin: 10px 0;
        text-align: center;
      }
      
      .ns-btn { 
        background: #e6e6e6;
        border: 1px solid #adadad;
        border-radius: 2px;
        padding: 6px 12px; 
        margin: 0 5px;
        cursor: pointer; 
        font-size: 11px; 
        font-weight: normal;
        color: #333;
        text-decoration: none;
        display: inline-block;
        transition: all 0.2s;
      }
      
      .ns-btn:hover { 
        background: #d4d5d6;
        border-color: #999;
      }
      
      .ns-btn.primary { 
        background: #003d82; 
        color: #fff; 
        border-color: #002952;
      }
      
      .ns-btn.primary:hover {
        background: #002952;
      }
      
      .ns-btn.secondary { 
        background: #5a6c7d; 
        color: #fff; 
        border-color: #4a5a6b;
      }
      
      .ns-btn.secondary:hover {
        background: #4a5a6b;
      }
      
      .ns-btn.success { 
        background: #28a745; 
        color: #fff; 
        border-color: #1e7e34;
      }
      
      .ns-btn.success:hover {
        background: #1e7e34;
      }
      
      .ns-btn[disabled] { 
        background: #f8f9fa !important;
        color: #999 !important;
        border-color: #dee2e6 !important;
        cursor: not-allowed;
      }
      
      /* Recommendations */
      .ns-recommendations { 
        background: #e8f5e8;
        border: 1px solid #c3e6cb;
        border-radius: 3px;
        padding: 12px; 
        margin: 15px 0;
      }
      
      .ns-recommendations h4 { 
        margin: 0 0 8px 0; 
        color: #155724;
        font-size: 12px;
        font-weight: bold;
      }
      
      .ns-recommendations ul { 
        margin: 5px 0; 
        padding-left: 20px; 
      }
      
      .ns-recommendations li { 
        margin: 3px 0; 
        line-height: 1.4;
        font-size: 11px;
      }
      
      /* Status indicators */
      .ns-status-paid { color: #28a745; font-weight: bold; }
      .ns-status-open { color: #007bff; font-weight: bold; }
      .ns-status-overdue { color: #dc3545; font-weight: bold; }
      .ns-status-default { color: #666; }
      
      /* Priority indicators */
      .ns-priority-critical { color: #dc3545; font-weight: bold; }
      .ns-priority-high { color: #fd7e14; font-weight: bold; }
      .ns-priority-medium { color: #ffc107; font-weight: bold; }
      
      /* Forecast items */
      .ns-forecast-section {
        background: #f7f8f9;
        border: 1px solid #e0e1e2;
        border-radius: 3px;
        padding: 12px;
        margin: 10px 0;
      }
      
      .ns-forecast-item { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        padding: 8px 0; 
        border-bottom: 1px solid #e0e1e2;
        font-size: 11px;
      }
      
      .ns-forecast-item:last-child {
        border-bottom: none;
      }
      
      .ns-forecast-period { 
        font-weight: bold; 
      }
      
      .ns-forecast-amount { 
        font-weight: bold; 
        color: #003d82;
      }
      
      .ns-overdue { 
        color: #dc3545; 
      }
      
      /* Responsive adjustments */
      @media (max-width: 768px) {
        .ns-feature-grid {
          grid-template-columns: 1fr;
        }
        .ns-metrics-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
    <div id="analytics-result" class="ns-dashboard">
      <div class="ns-welcome-section">
        <div class="ns-section-header">
          <h2 class="ns-section-title">Customer Payment Analytics Dashboard</h2>
          <div class="ns-section-subtitle">Advanced payment analysis and risk management tools</div>
        </div>
        <div class="ns-feature-grid">
          <div class="ns-feature-card">
            <div class="ns-feature-icon">📊</div>
            <h4>Payment Performance Scoring</h4>
            <p>Grade customers A-F based on payment history and behavior patterns</p>
          </div>
          <div class="ns-feature-card">
            <div class="ns-feature-icon">⚠️</div>
            <h4>Risk Assessment</h4>
            <p>Identify problem accounts before they become collection issues</p>
          </div>
          <div class="ns-feature-card">
            <div class="ns-feature-icon">💰</div>
            <h4>Cash Flow Forecasting</h4>
            <p>Predict incoming payments and plan cash flow effectively</p>
          </div>
          <div class="ns-feature-card">
            <div class="ns-feature-icon">🎯</div>
            <h4>Collection Prioritization</h4>
            <p>Focus collection efforts on high-impact customer accounts</p>
          </div>
        </div>
        <div class="ns-instructions">
          <strong>Get Started:</strong> Select a customer above for detailed analysis, or use the action buttons above for dashboard insights.
        </div>
      </div>
    </div>`;

  return form;
}

function createSuccessResponse(data: any) {
  return {
    success: true,
    data: data,
  };
}

function createErrorResponse(err: any) {
  return { success: false, error: String(err && (err.message || err)) };
}
