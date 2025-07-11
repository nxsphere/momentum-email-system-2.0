import { HandlebarsTemplateEngine } from "../services/template-engine.service";
import { SupabaseTemplateStorage } from "../services/template-storage.service";
import { createTrackingUrlService } from "../services/tracking-url.service";
import { TemplateEngineConfig, TrackingConfig } from "../types/template-engine";

export interface TemplateEngineFactoryConfig {
  // Tracking configuration
  tracking: {
    baseUrl: string;
    enablePixelTracking?: boolean;
    enableClickTracking?: boolean;
    enableOpenTracking?: boolean;
    utmParams?: {
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
    };
  };

  // Company information
  company: {
    name: string;
    address?: string;
  };

  // Template engine configuration
  engine?: Partial<TemplateEngineConfig>;

  // Environment-specific settings
  environment?: "development" | "staging" | "production";
}

export function createTemplateEngineConfig(): TemplateEngineFactoryConfig {
  const baseUrl =
    process.env.TEMPLATE_TRACKING_BASE_URL || "https://track.example.com";
  const companyName = process.env.COMPANY_NAME || "Your Company";
  const companyAddress = process.env.COMPANY_ADDRESS;
  const environment =
    (process.env.NODE_ENV as "development" | "staging" | "production") ||
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
        // SECURITY: Always enable sanitization by default (can be explicitly disabled via env var)
        sanitizeHtml: process.env.DISABLE_HTML_SANITIZATION !== "true",
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

export function createTemplateEngine(
  config?: Partial<TemplateEngineFactoryConfig>
): HandlebarsTemplateEngine {
  const defaultConfig = createTemplateEngineConfig();
  const mergedConfig = { ...defaultConfig, ...config };

  // Create storage service
  const storage = new SupabaseTemplateStorage();

  // Create tracking service
  const trackingConfig: TrackingConfig = {
    pixel_enabled: mergedConfig.tracking.enablePixelTracking ?? true,
    click_tracking_enabled: mergedConfig.tracking.enableClickTracking ?? true,
    open_tracking_enabled: mergedConfig.tracking.enableOpenTracking ?? true,
    utm_params: mergedConfig.tracking.utmParams,
  };

  const trackingService = createTrackingUrlService(
    mergedConfig.tracking.baseUrl,
    trackingConfig
  );

  // Create template engine
  return new HandlebarsTemplateEngine(
    storage,
    trackingService,
    mergedConfig.engine
  );
}

// Environment variable validation
export function validateTemplateEngineConfig(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

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
    } catch {
      errors.push("TEMPLATE_TRACKING_BASE_URL must be a valid URL");
    }
  }

  // Validate numeric configurations
  if (
    process.env.MAX_TEMPLATE_SIZE &&
    isNaN(parseInt(process.env.MAX_TEMPLATE_SIZE))
  ) {
    errors.push("MAX_TEMPLATE_SIZE must be a number");
  }

  if (
    process.env.MAX_TEMPLATE_VARIABLES &&
    isNaN(parseInt(process.env.MAX_TEMPLATE_VARIABLES))
  ) {
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
export const templateEngine = createTemplateEngine();

// Export commonly used configurations
export const defaultTemplateEngineConfig: TemplateEngineConfig = {
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
export function createTemplateContext(
  contact: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    metadata?: any;
  },
  variables: Record<string, any> = {},
  campaign?: { id: string; name: string; metadata?: any }
) {
  const config = createTemplateEngineConfig();

  return {
    contact: {
      ...contact,
      full_name:
        contact.first_name && contact.last_name
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
