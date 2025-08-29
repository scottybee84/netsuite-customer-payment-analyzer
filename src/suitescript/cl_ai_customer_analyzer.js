/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(["require", "exports", "N/ui/dialog"], function (require, exports, dialog) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.pageInit = pageInit;
    exports.analyzeCustomer = analyzeCustomer;
    function pageInit(scriptContext) {
        console.log("Client script initialized");
        const analyzeBtn = document.getElementById("analyze-btn");
        if (analyzeBtn) {
            analyzeBtn.onclick = function () {
                analyzeCustomer();
            };
            console.log("Button click handler attached via client script");
        }
    }
    function getSelectedCustomerId() {
        const customerSelect = document.getElementById("custpage_customer");
        return customerSelect ? customerSelect.value : "";
    }
    function showLoading(analyzeBtn) {
        if (!analyzeBtn)
            analyzeBtn = document.getElementById("analyze-btn");
        if (analyzeBtn) {
            analyzeBtn.setAttribute("disabled", "true");
            analyzeBtn.textContent = "🤖 Analyzing...";
            analyzeBtn.classList.remove && analyzeBtn.classList.remove("primary");
            analyzeBtn.classList.add && analyzeBtn.classList.add("disabled");
            analyzeBtn.style.cursor = "not-allowed";
        }
    }
    function resetUI(analyzeBtn) {
        if (!analyzeBtn)
            analyzeBtn = document.getElementById("analyze-btn");
        if (analyzeBtn) {
            analyzeBtn.removeAttribute("disabled");
            analyzeBtn.textContent = "Analyze with AI";
            if (analyzeBtn.classList && analyzeBtn.classList.contains("disabled"))
                analyzeBtn.classList.remove("disabled");
            if (analyzeBtn.classList && !analyzeBtn.classList.contains("primary"))
                analyzeBtn.classList.add("primary");
            analyzeBtn.style.cursor = "pointer";
        }
    }
    function postPromise(options) {
        if (!options || !options.url)
            return Promise.reject(new Error("Missing options.url"));
        return fetch(options.url, {
            method: "POST",
            credentials: "same-origin",
            headers: options.headers || { "Content-Type": "application/json" },
            body: options.body,
        }).then((r) => r.text().then((text) => ({
            code: r.status,
            body: text,
            headers: {
                "content-type": (r.headers && r.headers.get && r.headers.get("content-type")) ||
                    "application/json",
            },
        })));
    }
    function parseAIResult(raw) {
        if (!raw)
            return { parsed: null, formatted: raw };
        let jsonStr = raw;
        if (jsonStr.includes("```json"))
            jsonStr = jsonStr
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim();
        try {
            return { parsed: JSON.parse(jsonStr), formatted: raw };
        }
        catch (e) {
            const m = raw.match(/\{[\s\S]*\}/);
            if (m) {
                try {
                    return { parsed: JSON.parse(m[0]), formatted: raw };
                }
                catch (e2) {
                    /* fallthrough */
                }
            }
        }
        return { parsed: null, formatted: raw };
    }
    function formatCurrency(n) {
        let num = Number(n || 0);
        if (isNaN(num))
            num = 0;
        try {
            return num.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
        }
        catch (e) {
            const parts = (num.toFixed(2) + "").split(".");
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            return parts.join(".");
        }
    }
    function renderSuccess(data, parsedAI, resultDiv) {
        if (!resultDiv)
            resultDiv = document.getElementById("analysis-result");
        if (!resultDiv)
            return;
        let createdWrapper = false;
        try {
            const outerPanel = resultDiv.closest && resultDiv.closest(".ns-panel");
            if (outerPanel) {
                outerPanel.style.border = "1px solid #e6e6e6";
                outerPanel.style.background = "#fff";
                outerPanel.style.boxShadow = "none";
                outerPanel.style.padding = "12px";
            }
            else
                createdWrapper = true;
        }
        catch (e) {
            createdWrapper = true;
        }
        const inner = [];
        inner.push('<div style="padding:12px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">');
        inner.push("<div>");
        inner.push('<div class="ns-heading">✅ AI Analysis Complete</div>');
        inner.push(`<div class="ns-muted" style="margin-top:6px">Invoices analyzed: <strong>${data.invoiceCount}</strong> · Outstanding: <strong>$${formatCurrency(data.outstandingAmount)}</strong></div>`);
        inner.push("</div>");
        inner.push("</div>");
        inner.push('<div style="margin-top:12px;padding:0 6px">');
        if (parsedAI) {
            let riskClass = "";
            if (parsedAI.riskLevel) {
                const rl = String(parsedAI.riskLevel).toLowerCase();
                if (rl.indexOf("high") !== -1)
                    riskClass = "high";
                else if (rl.indexOf("medium") !== -1)
                    riskClass = "medium";
                else
                    riskClass = "low";
            }
            inner.push(parsedAI.riskLevel
                ? `<div style="margin-bottom:8px"><strong>Risk Level:</strong> <span class="ns-badge ${riskClass}">${parsedAI.riskLevel}</span></div>`
                : "");
            inner.push(parsedAI.summary
                ? `<div style="margin-bottom:10px"><strong>Summary</strong><div class="ns-muted" style="margin-top:6px"><div style="background:#eef7ff;border:1px solid #d7ecff;padding:22px 24px;border-radius:12px;color:#0b3a5a;margin-bottom:16px;line-height:1.6;font-size:13px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.6)">${parsedAI.summary}</div></div></div>`
                : "");
            inner.push(parsedAI.recommendedEmail
                ? `<div style="margin-top:8px"><strong>Recommended email</strong><div class="ns-muted" style="margin-top:6px">${parsedAI.recommendedEmail}</div></div>`
                : "");
        }
        else {
            inner.push(`<pre style="white-space:pre-wrap;margin:0;padding:10px;border:1px solid #eee;background:#fafafa;border-radius:4px">${data.result}</pre>`);
        }
        inner.push("</div>");
        let html = inner.join("");
        if (createdWrapper) {
            html =
                '<div class="ns-panel" style="padding:12px;border:1px solid #e6e6e6;border-radius:8px;background:#fff">' +
                    html +
                    "</div>";
        }
        resultDiv.innerHTML = html;
    }
    function renderFailure(message, resultDiv) {
        if (!resultDiv)
            resultDiv = document.getElementById("analysis-result");
        if (!resultDiv)
            return;
        resultDiv.innerHTML = `
      <div class="ns-panel">
        <div class="ns-heading" style="color:#d04545">❌ Analysis Failed</div>
        <div class="ns-muted" style="margin-top:8px">${message}</div>
      </div>
    `;
    }
    function analyzeCustomer() {
        console.log("Analyze button clicked");
        const customerSelect = document.getElementById("custpage_customer");
        const customerId = customerSelect ? customerSelect.value : "";
        if (!customerId) {
            dialog.alert({
                title: "Missing Customer",
                message: "Please select a customer first",
            });
            return;
        }
        const sel = getSelectedCustomerId();
        if (!sel) {
            dialog.alert({
                title: "Missing Customer",
                message: "Please select a customer first",
            });
            return;
        }
        showLoading();
        const currentUrl = window.location.href;
        postPromise({
            url: currentUrl,
            body: JSON.stringify({ customerId: sel }),
            headers: { "Content-Type": "application/json" },
        })
            .then((httpResponse) => {
            let data;
            try {
                data = JSON.parse(httpResponse.body);
            }
            catch (e) {
                throw new Error("Invalid JSON response");
            }
            resetUI();
            if (data.success) {
                const parsed = parseAIResult(data.result);
                renderSuccess(data, parsed.parsed);
            }
            else {
                renderFailure(data.error || "Unknown error");
            }
        })
            .catch((error) => {
            resetUI();
            renderFailure(error.message || String(error));
        });
    }
    exports.default = {
        pageInit,
        analyzeCustomer,
    };
});
