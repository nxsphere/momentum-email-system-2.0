import { EmailTemplate } from "../types/email-system";
import { TemplateStorage, TemplateValidationResult } from "../types/template-engine";
export declare class SupabaseTemplateStorage implements TemplateStorage {
    getTemplate(templateId: string): Promise<EmailTemplate | null>;
    getTemplateByName(name: string): Promise<EmailTemplate | null>;
    saveTemplate(template: Partial<EmailTemplate>): Promise<EmailTemplate>;
    updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate>;
    deleteTemplate(templateId: string): Promise<void>;
    listTemplates(limit?: number, offset?: number): Promise<EmailTemplate[]>;
    validateTemplate(templateId: string): Promise<TemplateValidationResult>;
    private extractBasicVariables;
    private inferVariableType;
    searchTemplates(query: string, limit?: number): Promise<EmailTemplate[]>;
    incrementUsageCount(templateId: string): Promise<void>;
    getTemplateStats(_templateId: string): Promise<{
        usage_count: number;
        last_used: string | null;
        campaigns_using: number;
    }>;
}
