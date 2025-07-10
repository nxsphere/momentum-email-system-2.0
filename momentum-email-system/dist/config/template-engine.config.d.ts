import { HandlebarsTemplateEngine } from "../services/template-engine.service";
import { TemplateEngineConfig } from "../types/template-engine";
export interface TemplateEngineFactoryConfig {
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
    company: {
        name: string;
        address?: string;
    };
    engine?: Partial<TemplateEngineConfig>;
    environment?: "development" | "staging" | "production";
}
export declare function createTemplateEngineConfig(): TemplateEngineFactoryConfig;
export declare function createTemplateEngine(config?: Partial<TemplateEngineFactoryConfig>): HandlebarsTemplateEngine;
export declare function validateTemplateEngineConfig(): {
    valid: boolean;
    errors: string[];
};
export declare const templateEngine: HandlebarsTemplateEngine;
export declare const defaultTemplateEngineConfig: TemplateEngineConfig;
export declare function createTemplateContext(contact: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    metadata?: any;
}, variables?: Record<string, any>, campaign?: {
    id: string;
    name: string;
    metadata?: any;
}): {
    contact: {
        full_name: string;
        id: string;
        email: string;
        first_name?: string;
        last_name?: string;
        metadata?: any;
    };
    campaign: {
        id: string;
        name: string;
        metadata?: any;
    } | undefined;
    system: {
        unsubscribe_url: string;
        tracking_pixel_url: string;
        view_in_browser_url: string;
        company_name: string;
        company_address: string;
        current_date: string;
        current_year: number;
    };
    variables: Record<string, any>;
};
