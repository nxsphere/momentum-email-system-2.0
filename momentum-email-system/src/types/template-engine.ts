import { JsonObject, JsonValue } from "./email-provider";
import { EmailTemplate } from "./email-system";

export interface TemplateVariable {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "url" | "email";
  required: boolean;
  defaultValue?: JsonValue;
  description?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

export interface TemplateContext {
  // Contact information
  contact: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    metadata?: JsonObject;
  };

  // Campaign information
  campaign?: {
    id: string;
    name: string;
    metadata?: JsonObject;
  };

  // System variables
  system: {
    unsubscribe_url: string;
    tracking_pixel_url: string;
    view_in_browser_url?: string;
    company_name: string;
    company_address?: string;
    current_date: string;
    current_year: number;
  };

  // Custom variables
  variables: JsonObject;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: TemplateValidationError[];
  warnings: TemplateValidationWarning[];
  variables: TemplateVariable[];
}

export interface TemplateValidationError {
  type:
    | "syntax"
    | "missing_variable"
    | "invalid_helper"
    | "compilation"
    | "security";
  message: string;
  line?: number;
  column?: number;
  context?: string;
}

export interface TemplateValidationWarning {
  type:
    | "unused_variable"
    | "deprecated_helper"
    | "performance"
    | "accessibility"
    | "security";
  message: string;
  line?: number;
  column?: number;
  context?: string;
}

export interface CompiledTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string;
  variables: TemplateVariable[];
  compiled_at: Date;
  template_hash: string;
}

export interface RenderResult {
  subject: string;
  html: string;
  text: string;
  tracking: {
    pixel_url: string;
    unsubscribe_url: string;
    click_tracking_enabled: boolean;
  };
  metadata: {
    template_id: string;
    contact_id: string;
    campaign_id?: string;
    rendered_at: Date;
    variables_used: string[];
  };
}

export interface TemplateEngineConfig {
  // Handlebars configuration
  handlebars: {
    noEscape?: boolean;
    strict?: boolean;
    preventIndent?: boolean;
    ignoreStandalone?: boolean;
  };

  // Template validation
  validation: {
    enableSyntaxCheck: boolean;
    enableVariableCheck: boolean;
    enableSecurityCheck: boolean;
    allowedHelpers: string[];
    blockedHelpers: string[];
  };

  // Tracking configuration
  tracking: {
    enableClickTracking: boolean;
    enableOpenTracking: boolean;
    trackingDomain: string;
    pixelPath: string;
    unsubscribePath: string;
    clickPath: string;
  };

  // Text generation
  textGeneration: {
    wordwrap: number;
    preserveLineBreaks: boolean;
    uppercaseHeadings: boolean;
    linkHrefToText: boolean;
  };

  // Security
  security: {
    maxTemplateSize: number;
    maxVariables: number;
    allowScriptTags: boolean;
    allowStyleTags: boolean;
    sanitizeHtml: boolean;
  };
}

export interface TemplateEngineStats {
  templates: {
    total: number;
    valid: number;
    invalid: number;
    cached: number;
  };
  rendering: {
    total_renders: number;
    successful_renders: number;
    failed_renders: number;
    average_render_time: number;
  };
  validation: {
    syntax_errors: number;
    variable_errors: number;
    security_errors: number;
  };
}

export interface TemplateCache {
  get(templateId: string): CompiledTemplate | null;
  set(templateId: string, template: CompiledTemplate): void;
  invalidate(templateId: string): void;
  clear(): void;
  size(): number;
}

export interface TrackingUrlGenerator {
  generatePixelUrl(
    templateId: string,
    contactId: string,
    campaignId?: string
  ): string;
  generateUnsubscribeUrl(contactId: string, campaignId?: string): string;
  generateClickTrackingUrl(
    originalUrl: string,
    templateId: string,
    contactId: string,
    campaignId?: string
  ): string;
  generateViewInBrowserUrl(
    templateId: string,
    contactId: string,
    campaignId?: string
  ): string;
}

export interface TemplateStorage {
  getTemplate(templateId: string): Promise<EmailTemplate | null>;
  getTemplateByName(name: string): Promise<EmailTemplate | null>;
  saveTemplate(template: Partial<EmailTemplate>): Promise<EmailTemplate>;
  updateTemplate(
    templateId: string,
    updates: Partial<EmailTemplate>
  ): Promise<EmailTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
  listTemplates(limit?: number, offset?: number): Promise<EmailTemplate[]>;
  validateTemplate(templateId: string): Promise<TemplateValidationResult>;
}

export interface TemplateRenderer {
  render(
    template: EmailTemplate,
    context: TemplateContext
  ): Promise<RenderResult>;
  renderPreview(
    template: EmailTemplate,
    sampleContext: Partial<TemplateContext>
  ): Promise<RenderResult>;
  validate(template: EmailTemplate): Promise<TemplateValidationResult>;
}

export interface TemplateEngine {
  // Core functionality
  loadTemplate(templateId: string): Promise<CompiledTemplate>;
  renderTemplate(
    templateId: string,
    context: TemplateContext
  ): Promise<RenderResult>;
  validateTemplate(template: EmailTemplate): Promise<TemplateValidationResult>;

  // Template management
  compileTemplate(template: EmailTemplate): Promise<CompiledTemplate>;
  precompileTemplates(templateIds: string[]): Promise<void>;

  // Preview functionality
  renderPreview(
    template: EmailTemplate,
    sampleData?: JsonObject
  ): Promise<RenderResult>;

  // Utility functions
  extractVariables(templateContent: string): TemplateVariable[];
  generateSampleContext(variables: TemplateVariable[]): TemplateContext;

  // Statistics and monitoring
  getStats(): Promise<TemplateEngineStats>;
  clearCache(): void;
}

// Helper types for specific use cases
export interface PersonalizationData {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email: string;
  company?: string;
  job_title?: string;
  custom_fields?: JsonObject;
}

export interface UnsubscribeConfig {
  enabled: boolean;
  url_template: string;
  link_text: string;
  footer_text: string;
}

export interface TrackingConfig {
  pixel_enabled: boolean;
  click_tracking_enabled: boolean;
  open_tracking_enabled: boolean;
  utm_params?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

export interface TemplatePreprocessor {
  process(content: string, context: TemplateContext): Promise<string>;
}

export interface TemplatePostprocessor {
  process(
    rendered: RenderResult,
    context: TemplateContext
  ): Promise<RenderResult>;
}
