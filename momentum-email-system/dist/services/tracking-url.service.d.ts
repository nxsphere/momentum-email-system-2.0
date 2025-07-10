import { TrackingConfig, TrackingUrlGenerator } from "../types/template-engine";
export declare class TrackingUrlService implements TrackingUrlGenerator {
    private baseUrl;
    private config;
    constructor(baseUrl: string, config: TrackingConfig);
    generatePixelUrl(templateId: string, contactId: string, campaignId?: string): string;
    generateUnsubscribeUrl(contactId: string, campaignId?: string): string;
    generateClickTrackingUrl(originalUrl: string, templateId: string, contactId: string, campaignId?: string): string;
    generateViewInBrowserUrl(templateId: string, contactId: string, campaignId?: string): string;
    generateManagePreferencesUrl(contactId: string): string;
    addUtmParameters(url: string, campaignId?: string, medium?: string, source?: string): string;
    generateTrackingPixelHtml(templateId: string, contactId: string, campaignId?: string): string;
    generateUnsubscribeFooterHtml(contactId: string, campaignId?: string, customText?: string): string;
    generateCompanyFooterHtml(companyName: string, companyAddress?: string): string;
    validateTrackingUrl(url: string): boolean;
    parseTrackingUrl(url: string): {
        templateId?: string;
        contactId?: string;
        campaignId?: string;
        event?: string;
        timestamp?: number;
        signature?: string;
    };
    private generateSignature;
    private generateUnsubscribeToken;
    private generateViewToken;
}
export declare function createTrackingUrlService(baseUrl: string, customConfig?: Partial<TrackingConfig>): TrackingUrlService;
export declare class TrackingUtils {
    static extractEmailFromTrackingUrl(url: string): string | null;
    static isTrackingUrl(url: string, trackingDomain: string): boolean;
    static sanitizeRedirectUrl(url: string, allowedDomains?: string[]): string | null;
}
