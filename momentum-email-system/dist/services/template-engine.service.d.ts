import { EmailTemplate } from "../types/email-system";
import { CompiledTemplate, RenderResult, TemplateContext, TemplateEngine, TemplateEngineConfig, TemplateEngineStats, TemplateValidationResult, TemplateVariable } from "../types/template-engine";
import { SupabaseTemplateStorage } from "./template-storage.service";
import { TrackingUrlService } from "./tracking-url.service";
export declare class HandlebarsTemplateEngine implements TemplateEngine {
    private handlebars;
    private storage;
    private trackingService;
    private cache;
    private config;
    private stats;
    constructor(storage: SupabaseTemplateStorage, trackingService: TrackingUrlService, config?: Partial<TemplateEngineConfig>);
    /**
     * Sanitize HTML content to prevent XSS attacks
     */
    private sanitizeHtml;
    /**
     * Sanitize template context variables to prevent XSS
     */
    private sanitizeContext;
    /**
     * Sanitize a string value
     */
    private sanitizeString;
    /**
     * Recursively sanitize an object
     */
    private sanitizeObject;
    loadTemplate(templateId: string): Promise<CompiledTemplate>;
    renderTemplate(templateId: string, context: TemplateContext): Promise<RenderResult>;
    validateTemplate(template: EmailTemplate): Promise<TemplateValidationResult>;
    compileTemplate(template: EmailTemplate): Promise<CompiledTemplate>;
    precompileTemplates(templateIds: string[]): Promise<void>;
    renderPreview(template: EmailTemplate, sampleData?: Record<string, any>): Promise<RenderResult>;
    extractVariables(templateContent: string): TemplateVariable[];
    generateSampleContext(variables: TemplateVariable[]): TemplateContext;
    getStats(): Promise<TemplateEngineStats>;
    clearCache(): void;
    private setupHandlebarsHelpers;
    private validateHandlebarsSyntax;
    private validateSecurity;
    private enhanceContext;
    private processHtmlTracking;
    private generateTextFromHtml;
    private validateContextVariables;
    private getVariableValue;
    private extractUsedVariables;
    private isSystemVariable;
    private isHandlebarsHelper;
    private inferVariableType;
    private generateSampleValue;
    private updateRenderingStats;
}
