"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultTemplateEngineConfig = exports.templateEngine = void 0;
exports.createTemplateEngineConfig = createTemplateEngineConfig;
exports.createTemplateEngine = createTemplateEngine;
exports.validateTemplateEngineConfig = validateTemplateEngineConfig;
exports.createTemplateContext = createTemplateContext;
const template_engine_service_1 = require("../services/template-engine.service");
const template_storage_service_1 = require("../services/template-storage.service");
const tracking_url_service_1 = require("../services/tracking-url.service");
function createTemplateEngineConfig() {
    const baseUrl = process.env.TEMPLATE_TRACKING_BASE_URL || "https://track.example.com";
    const companyName = process.env.COMPANY_NAME || "Your Company";
    const companyAddress = process.env.COMPANY_ADDRESS;
    const environment = process.env.NODE_ENV ||
        "development";
    return {
        tracking: {
            baseUrl,
            enablePixelTracking: process.env.ENABLE_PIXEL_TRACKING !== "false",
            enableClickTracking: process.env.ENABLE_CLICK_TRACKING !== "false",
            enableOpenTracking: process.env.ENABLE_OPEN_TRACKING !== "false",
            utmParams: {
                source: process.env.UTM_SOURCE || "email",
                medium: process.env.UTM_MEDIUM || "email",
                campaign: process.env.UTM_CAMPAIGN,
                term: process.env.UTM_TERM,
                content: process.env.UTM_CONTENT,
            },
        },
        company: {
            name: companyName,
            address: companyAddress,
        },
        engine: {
            validation: {
                enableSyntaxCheck: true,
                enableVariableCheck: true,
                enableSecurityCheck: environment === "production",
                allowedHelpers: [
                    "if",
                    "unless",
                    "each",
                    "with",
                    "eq",
                    "ne",
                    "gt",
                    "lt",
                    "and",
                    "or",
                    "not",
                    "lookup",
                    "formatDate",
                    "capitalize",
                    "upper",
                    "lower",
                    "urlEncode",
                    "default",
                ],
                blockedHelpers: ["eval", "exec", "require", "import"],
            },
            security: {
                maxTemplateSize: parseInt(process.env.MAX_TEMPLATE_SIZE || "500000"),
                maxVariables: parseInt(process.env.MAX_TEMPLATE_VARIABLES || "100"),
                allowScriptTags: false,
                allowStyleTags: true,
                sanitizeHtml: environment === "production",
            },
            textGeneration: {
                wordwrap: parseInt(process.env.TEXT_WORDWRAP || "80"),
                preserveLineBreaks: true,
                uppercaseHeadings: false,
                linkHrefToText: true,
            },
        },
        environment,
    };
}
function createTemplateEngine(config) {
    const defaultConfig = createTemplateEngineConfig();
    const mergedConfig = { ...defaultConfig, ...config };
    // Create storage service
    const storage = new template_storage_service_1.SupabaseTemplateStorage();
    // Create tracking service
    const trackingConfig = {
        pixel_enabled: mergedConfig.tracking.enablePixelTracking ?? true,
        click_tracking_enabled: mergedConfig.tracking.enableClickTracking ?? true,
        open_tracking_enabled: mergedConfig.tracking.enableOpenTracking ?? true,
        utm_params: mergedConfig.tracking.utmParams,
    };
    const trackingService = (0, tracking_url_service_1.createTrackingUrlService)(mergedConfig.tracking.baseUrl, trackingConfig);
    // Create template engine
    return new template_engine_service_1.HandlebarsTemplateEngine(storage, trackingService, mergedConfig.engine);
}
// Environment variable validation
function validateTemplateEngineConfig() {
    const errors = [];
    if (!process.env.COMPANY_NAME) {
        errors.push("COMPANY_NAME environment variable is required");
    }
    if (!process.env.TEMPLATE_TRACKING_BASE_URL) {
        errors.push("TEMPLATE_TRACKING_BASE_URL environment variable is required");
    }
    // Validate tracking base URL format
    if (process.env.TEMPLATE_TRACKING_BASE_URL) {
        try {
            new URL(process.env.TEMPLATE_TRACKING_BASE_URL);
        }
        catch {
            errors.push("TEMPLATE_TRACKING_BASE_URL must be a valid URL");
        }
    }
    // Validate numeric configurations
    if (process.env.MAX_TEMPLATE_SIZE &&
        isNaN(parseInt(process.env.MAX_TEMPLATE_SIZE))) {
        errors.push("MAX_TEMPLATE_SIZE must be a number");
    }
    if (process.env.MAX_TEMPLATE_VARIABLES &&
        isNaN(parseInt(process.env.MAX_TEMPLATE_VARIABLES))) {
        errors.push("MAX_TEMPLATE_VARIABLES must be a number");
    }
    if (process.env.TEXT_WORDWRAP && isNaN(parseInt(process.env.TEXT_WORDWRAP))) {
        errors.push("TEXT_WORDWRAP must be a number");
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
// Default template engine instance
exports.templateEngine = createTemplateEngine();
// Export commonly used configurations
exports.defaultTemplateEngineConfig = {
    handlebars: {
        noEscape: false,
        strict: true,
        preventIndent: false,
        ignoreStandalone: false,
    },
    validation: {
        enableSyntaxCheck: true,
        enableVariableCheck: true,
        enableSecurityCheck: true,
        allowedHelpers: [
            "if",
            "unless",
            "each",
            "with",
            "eq",
            "ne",
            "gt",
            "lt",
            "and",
            "or",
            "not",
            "lookup",
            "formatDate",
            "capitalize",
            "upper",
            "lower",
            "urlEncode",
            "default",
        ],
        blockedHelpers: ["eval", "exec", "require", "import"],
    },
    tracking: {
        enableClickTracking: true,
        enableOpenTracking: true,
        trackingDomain: "track.example.com",
        pixelPath: "/pixel.gif",
        unsubscribePath: "/unsubscribe",
        clickPath: "/click",
    },
    textGeneration: {
        wordwrap: 80,
        preserveLineBreaks: true,
        uppercaseHeadings: false,
        linkHrefToText: true,
    },
    security: {
        maxTemplateSize: 500000, // 500KB
        maxVariables: 100,
        allowScriptTags: false,
        allowStyleTags: true,
        sanitizeHtml: true,
    },
};
// Helper function to create a template context
function createTemplateContext(contact, variables = {}, campaign) {
    const config = createTemplateEngineConfig();
    return {
        contact: {
            ...contact,
            full_name: contact.first_name && contact.last_name
                ? `${contact.first_name} ${contact.last_name}`
                : contact.first_name || contact.last_name || "",
        },
        campaign,
        system: {
            unsubscribe_url: "", // Will be generated by template engine
            tracking_pixel_url: "", // Will be generated by template engine
            view_in_browser_url: "", // Will be generated by template engine
            company_name: config.company.name,
            company_address: config.company.address || "",
            current_date: new Date().toLocaleDateString(),
            current_year: new Date().getFullYear(),
        },
        variables,
    };
}
//# sourceMappingURL=template-engine.config.js.map