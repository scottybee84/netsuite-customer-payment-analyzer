/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

import * as dialog from "N/ui/dialog";

export function pageInit(scriptContext: any) {
  console.log("Payment Analytics Client script initialized");

  const analyzeBtn = document.getElementById("analyze-customer-btn");
  const riskBtn = document.getElementById("risk-analysis-btn");
  const cashFlowBtn = document.getElementById("cash-flow-btn");

  if (analyzeBtn) {
    analyzeBtn.onclick = function () {
      analyzeCustomerPerformance();
    };
  }

  if (riskBtn) {
    riskBtn.onclick = function () {
      showTopRiskCustomers();
    };
  }

  if (cashFlowBtn) {
    cashFlowBtn.onclick = function () {
      showCashFlowForecast();
    };
  }
}

function getSelectedCustomerId(): string {
  const customerSelect = document.getElementById(
    "custpage_customer"
  ) as HTMLSelectElement | null;
  return customerSelect ? customerSelect.value : "";
}

function showLoading(button: HTMLElement | null, originalText: string) {
  if (!button) return;
  (button as HTMLButtonElement).setAttribute("disabled", "true");
  button.textContent = "⏳ Loading...";
  button.classList.add("disabled");
}

function resetButton(button: HTMLElement | null, originalText: string, className: string) {
  if (!button) return;
  (button as HTMLButtonElement).removeAttribute("disabled");
  button.innerHTML = originalText;
  button.classList.remove("disabled");
  button.classList.add(className);
}

function postPromise(options: {
  url: string;
  body?: string;
  headers?: Record<string, string>;
}) {
  return fetch(options.url, {
    method: "POST",
    credentials: "same-origin",
    headers: options.headers || { "Content-Type": "application/json" },
    body: options.body,
  }).then((r) =>
    r.text().then((text) => ({
      code: r.status,
      body: text,
    }))
  );
}

function formatCurrency(n: any): string {
  let num = Number(n || 0);
  if (isNaN(num)) num = 0;
  return "$" + num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  } catch (e) {
    return dateStr;
  }
}

function renderPaymentAnalytics(data: any, resultDiv?: HTMLElement | null) {
  if (!resultDiv) resultDiv = document.getElementById("analytics-result");
  if (!resultDiv) return;

  const customer = data.customer;
  const paymentScore = data.paymentScore;
  const riskAssessment = data.riskAssessment;
  const recommendations = data.recommendations;

  const scoreClass = paymentScore.grade.toLowerCase().replace('+', '').replace('-', '');

  const html = `
    <div class="ns-panel">
      <div class="ns-panel-header">Payment Performance Analysis: ${customer.companyname}</div>
      <div class="ns-panel-body">
      
      <div class="ns-metrics-grid">
        <div class="ns-metric-card">
          <div class="ns-metric-label">Payment Score</div>
          <div class="ns-metric-value">${paymentScore.score}/100</div>
          <span class="ns-score-badge ns-score-${scoreClass}">Grade: ${paymentScore.grade}</span>
        </div>
        
        <div class="ns-metric-card">
          <div class="ns-metric-label">Risk Level</div>
          <div class="ns-metric-value ns-risk-${riskAssessment.level.toLowerCase()}">${riskAssessment.level}</div>
          <div class="ns-metric-subtitle">${riskAssessment.score} risk points</div>
        </div>
        
        <div class="ns-metric-card">
          <div class="ns-metric-label">Outstanding Balance</div>
          <div class="ns-metric-value" style="color: #003d82;">${formatCurrency(data.totalOutstanding)}</div>
          <div class="ns-metric-subtitle">${data.totalInvoices} total invoices</div>
        </div>
        
        <div class="ns-metric-card">
          <div class="ns-metric-label">Credit Utilization</div>
          <div class="ns-metric-value" style="color: #003d82;">
            ${customer.creditlimit > 0 ? Math.round((customer.balance / customer.creditlimit) * 100) : 0}%
          </div>
          <div class="ns-metric-subtitle">
            ${formatCurrency(customer.balance)} / ${formatCurrency(customer.creditlimit)}
          </div>
        </div>
      </div>

      <div class="ns-panel-header" style="margin: 20px -15px 15px -15px; background: #f7f8f9;">Performance Factors</div>
      <div class="ns-forecast-section">
        ${paymentScore.factors.overdue_rate !== undefined ? `
          <div style="margin-bottom: 8px; font-size: 11px;">
            <strong>Overdue Rate:</strong> ${paymentScore.factors.overdue_rate}%
            ${paymentScore.factors.overdue_rate > 20 ? ' <span class="ns-risk-high">⚠️ High</span>' : ' <span class="ns-risk-low">✅ Good</span>'}
          </div>
        ` : ''}
        
        <div style="margin-bottom: 8px; font-size: 11px;">
          <strong>Outstanding Amount:</strong> ${formatCurrency(paymentScore.factors.outstanding_amount)}
        </div>
        
        ${riskAssessment.factors.length > 0 ? `
          <div style="font-size: 11px;">
            <strong>Risk Factors:</strong>
            <ul style="margin: 8px 0; padding-left: 20px;">
              ${riskAssessment.factors.map((factor: string) => `<li style="margin: 3px 0;">${factor}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      ${recommendations.length > 0 ? `
        <div class="ns-recommendations">
          <h4>Recommended Actions</h4>
          <ul>
            ${recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="ns-panel-header" style="margin: 20px -15px 15px -15px; background: #f7f8f9;">Recent Invoice Activity</div>
      <table class="ns-table">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Date</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${data.invoices.slice(0, 10).map((inv: any) => `
            <tr>
              <td>${inv.tranid || "N/A"}</td>
              <td>${formatDate(inv.trandate)}</td>
              <td>${formatDate(inv.duedate)}</td>
              <td><span class="ns-${getStatusClass(inv.status)}">${inv.status || "N/A"}</span></td>
              <td style="text-align: right; font-weight: bold;">${formatCurrency(inv.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${data.invoices.length > 10 ? `<div style="font-size: 11px; color: #666; margin-top: 8px;">Showing 10 of ${data.invoices.length} invoices</div>` : ''}
      </div>
    </div>`;

  resultDiv.innerHTML = html;
}

function renderRiskCustomers(customers: any[], resultDiv?: HTMLElement | null) {
  if (!resultDiv) resultDiv = document.getElementById("analytics-result");
  if (!resultDiv) return;

  const html = `
    <div class="ns-panel">
      <div class="ns-panel-header">High Risk Customers - Collection Priority List</div>
      <div class="ns-panel-body">
      <div style="font-size: 11px; color: #666; margin-bottom: 15px;">
        Customers ranked by risk score. Focus collection efforts on these accounts first.
      </div>
      
      <table class="ns-table">
        <thead>
          <tr>
            <th>Risk Score</th>
            <th>Customer</th>
            <th>Entity ID</th>
            <th>Outstanding</th>
            <th>Credit Utilization</th>
            <th>Action Priority</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map((customer: any, index: number) => `
            <tr>
              <td>
                <span class="ns-score-badge" style="background: ${getRiskBgColor(customer.riskScore)}; color: white; padding: 4px 8px; border-radius: 2px; font-weight: bold; font-size: 10px;">
                  ${customer.riskScore}
                </span>
              </td>
              <td><strong>${customer.companyname || customer.entityid}</strong></td>
              <td>${customer.entityid}</td>
              <td style="text-align: right; font-weight: bold;">${formatCurrency(customer.balance)}</td>
              <td style="text-align: center;">
                <span class="ns-risk-${customer.utilizationPercent > 90 ? 'critical' : customer.utilizationPercent > 70 ? 'high' : 'low'}">
                  ${customer.utilizationPercent}%
                </span>
              </td>
              <td>
                <span class="ns-priority-${index < 5 ? 'critical' : index < 10 ? 'high' : 'medium'}">
                  ${index < 5 ? 'Critical' : index < 10 ? 'High' : 'Medium'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    </div>
    
    <style>
      .ns-priority-critical { color: #dc3545; font-weight: bold; }
      .ns-priority-high { color: #fd7e14; font-weight: bold; }
      .ns-priority-medium { color: #ffc107; font-weight: bold; }
    </style>`;

  resultDiv.innerHTML = html;
}

function renderCashFlowForecast(forecast: any, resultDiv?: HTMLElement | null) {
  if (!resultDiv) resultDiv = document.getElementById("analytics-result");
  if (!resultDiv) return;

  const totalExpected = forecast.next_7_days + forecast.next_30_days + forecast.next_60_days + forecast.next_90_days;

  const html = `
    <div class="ns-panel">
      <div class="ns-panel-header">Cash Flow Forecast - Expected Receivables</div>
      <div class="ns-panel-body">
      <div style="font-size: 11px; color: #666; margin-bottom: 20px;">
        Projected incoming payments based on outstanding invoices and due dates.
      </div>
      
      <div class="ns-metrics-grid">
        <div class="ns-metric-card">
          <div class="ns-metric-label">Overdue (Past Due)</div>
          <div class="ns-metric-value ns-overdue">${formatCurrency(forecast.overdue)}</div>
          <div class="ns-metric-subtitle">Immediate collection needed</div>
        </div>
        
        <div class="ns-metric-card">
          <div class="ns-metric-label">Next 7 Days</div>
          <div class="ns-metric-value ns-risk-low">${formatCurrency(forecast.next_7_days)}</div>
          <div class="ns-metric-subtitle">Expected this week</div>
        </div>
        
        <div class="ns-metric-card">
          <div class="ns-metric-label">Next 30 Days</div>
          <div class="ns-metric-value" style="color: #003d82;">${formatCurrency(forecast.next_30_days)}</div>
          <div class="ns-metric-subtitle">Expected this month</div>
        </div>
        
        <div class="ns-metric-card">
          <div class="ns-metric-label">Total Expected</div>
          <div class="ns-metric-value" style="color: #003d82;">${formatCurrency(totalExpected)}</div>
          <div class="ns-metric-subtitle">Next 90 days</div>
        </div>
      </div>

      <div class="ns-panel-header" style="margin: 20px -15px 15px -15px; background: #f7f8f9;">Payment Timeline</div>
      <div class="ns-forecast-section">
        <div class="ns-forecast-item">
          <span class="ns-forecast-period">Overdue (Action Required)</span>
          <span class="ns-forecast-amount ns-overdue">${formatCurrency(forecast.overdue)}</span>
        </div>
        <div class="ns-forecast-item">
          <span class="ns-forecast-period">Next 7 Days</span>
          <span class="ns-forecast-amount">${formatCurrency(forecast.next_7_days)}</span>
        </div>
        <div class="ns-forecast-item">
          <span class="ns-forecast-period">8-30 Days</span>
          <span class="ns-forecast-amount">${formatCurrency(forecast.next_30_days - forecast.next_7_days)}</span>
        </div>
        <div class="ns-forecast-item">
          <span class="ns-forecast-period">31-60 Days</span>
          <span class="ns-forecast-amount">${formatCurrency(forecast.next_60_days - forecast.next_30_days)}</span>
        </div>
        <div class="ns-forecast-item">
          <span class="ns-forecast-period">61-90 Days</span>
          <span class="ns-forecast-amount">${formatCurrency(forecast.next_90_days - forecast.next_60_days)}</span>
        </div>
      </div>

      <div class="ns-recommendations">
        <h4>Cash Flow Insights</h4>
        <ul>
          ${forecast.overdue > 10000 ? '<li><strong>High Priority:</strong> Focus collection efforts on overdue accounts - significant cash flow impact</li>' : ''}
          ${forecast.next_7_days > 50000 ? '<li><strong>Positive:</strong> Strong cash flow expected within 7 days</li>' : ''}
          ${totalExpected < 50000 ? '<li><strong>Concern:</strong> Lower than expected future receivables - consider sales acceleration</li>' : ''}
          ${forecast.overdue / totalExpected > 0.3 ? '<li><strong>Warning:</strong> High percentage of overdue vs future receivables</li>' : ''}
          <li><strong>Planning:</strong> Use these projections for cash flow planning and credit decisions</li>
        </ul>
      </div>
      </div>
    </div>`;

  resultDiv.innerHTML = html;
}

function getRiskColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'critical': return '#dc3545';
    case 'high': return '#fd7e14';
    case 'medium': return '#ffc107';
    default: return '#28a745';
  }
}

function getRiskBgColor(score: number): string {
  if (score >= 60) return '#dc3545';
  if (score >= 40) return '#fd7e14';
  if (score >= 20) return '#ffc107';
  return '#28a745';
}

function getStatusClass(status: string): string {
  switch (status?.toLowerCase()) {
    case 'paid': return 'status-paid';
    case 'open': return 'status-open';
    case 'overdue': return 'status-overdue';
    default: return 'status-default';
  }
}

function renderError(message: string, resultDiv?: HTMLElement | null) {
  if (!resultDiv) resultDiv = document.getElementById("analytics-result");
  if (!resultDiv) return;
  resultDiv.innerHTML = `
    <div class="ns-panel">
      <div class="ns-panel-header" style="color:#dc3545;">Error</div>
      <div class="ns-panel-body">
        <div style="font-size: 11px; color: #666;">${message}</div>
      </div>
    </div>`;
}

export function analyzeCustomerPerformance() {
  const customerId = getSelectedCustomerId();
  
  if (!customerId) {
    dialog.alert({
      title: "No Customer Selected",
      message: "Please select a customer from the dropdown first",
    });
    return;
  }

  const analyzeBtn = document.getElementById("analyze-customer-btn");
  showLoading(analyzeBtn, "Analyze Customer Performance");

  postPromise({
    url: window.location.href,
    body: JSON.stringify({ 
      action: "getPaymentAnalytics",
      customerId: customerId
    }),
    headers: { "Content-Type": "application/json" },
  })
    .then((httpResponse) => {
      const data = JSON.parse(httpResponse.body);
      resetButton(analyzeBtn, "Analyze Customer Performance", "primary");
      
      if (data.success) {
        renderPaymentAnalytics(data.data);
      } else {
        renderError(data.error || "Unknown error");
      }
    })
    .catch((error) => {
      resetButton(analyzeBtn, "Analyze Customer Performance", "primary");
      renderError(error.message || String(error));
    });
}

export function showTopRiskCustomers() {
  const riskBtn = document.getElementById("risk-analysis-btn");
  showLoading(riskBtn, "High Risk Customers");

  postPromise({
    url: window.location.href,
    body: JSON.stringify({ action: "getTopRiskCustomers" }),
    headers: { "Content-Type": "application/json" },
  })
    .then((httpResponse) => {
      const data = JSON.parse(httpResponse.body);
      resetButton(riskBtn, "High Risk Customers", "secondary");
      
      if (data.success) {
        renderRiskCustomers(data.data.riskCustomers);
      } else {
        renderError(data.error || "Unknown error");
      }
    })
    .catch((error) => {
      resetButton(riskBtn, "High Risk Customers", "secondary");
      renderError(error.message || String(error));
    });
}

export function showCashFlowForecast() {
  const cashFlowBtn = document.getElementById("cash-flow-btn");
  showLoading(cashFlowBtn, "Cash Flow Forecast");

  postPromise({
    url: window.location.href,
    body: JSON.stringify({ action: "getCashFlowForecast" }),
    headers: { "Content-Type": "application/json" },
  })
    .then((httpResponse) => {
      const data = JSON.parse(httpResponse.body);
      resetButton(cashFlowBtn, "Cash Flow Forecast", "success");
      
      if (data.success) {
        renderCashFlowForecast(data.data.forecast);
      } else {
        renderError(data.error || "Unknown error");
      }
    })
    .catch((error) => {
      resetButton(cashFlowBtn, "Cash Flow Forecast", "success");
      renderError(error.message || String(error));
    });
}

export default {
  pageInit,
  analyzeCustomerPerformance,
  showTopRiskCustomers,
  showCashFlowForecast,
};
