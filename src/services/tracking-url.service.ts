import { TrackingConfig, TrackingUrlGenerator } from "../types/template-engine";

export class TrackingUrlService implements TrackingUrlGenerator {
  private baseUrl: string;
  private config: TrackingConfig;

  constructor(baseUrl: string, config: TrackingConfig) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.config = config;
  }

  generatePixelUrl(
    templateId: string,
    contactId: string,
    campaignId?: string
  ): string {
    if (!this.config.pixel_enabled) {
      return "";
    }

    const params = new URLSearchParams({
      t: templateId,
      c: contactId,
      e: "open",
      ts: Date.now().toString(),
    });

    if (campaignId) {
      params.set("campaign", campaignId);
    }

    // Add tracking signature to prevent tampering
    const signature = this.generateSignature(
      `open:${templateId}:${contactId}:${campaignId || ""}`
    );
    params.set("s", signature);

    return `${this.baseUrl}/pixel.gif?${params.toString()}`;
  }

  generateUnsubscribeUrl(contactId: string, campaignId?: string): string {
    const params = new URLSearchParams({
      c: contactId,
      action: "unsubscribe",
      ts: Date.now().toString(),
    });

    if (campaignId) {
      params.set("campaign", campaignId);
    }

    // Add security token
    const token = this.generateUnsubscribeToken(contactId);
    params.set("token", token);

    return `${this.baseUrl}/unsubscribe?${params.toString()}`;
  }

  generateClickTrackingUrl(
    originalUrl: string,
    templateId: string,
    contactId: string,
    campaignId?: string
  ): string {
    if (!this.config.click_tracking_enabled) {
      return originalUrl;
    }

    const params = new URLSearchParams({
      url: encodeURIComponent(originalUrl),
      t: templateId,
      c: contactId,
      e: "click",
      ts: Date.now().toString(),
    });

    if (campaignId) {
      params.set("campaign", campaignId);
    }

    // Add tracking signature
    const signature = this.generateSignature(
      `click:${templateId}:${contactId}:${originalUrl}`
    );
    params.set("s", signature);

    return `${this.baseUrl}/click?${params.toString()}`;
  }

  generateViewInBrowserUrl(
    templateId: string,
    contactId: string,
    campaignId?: string
  ): string {
    const params = new URLSearchParams({
      t: templateId,
      c: contactId,
      action: "view",
      ts: Date.now().toString(),
    });

    if (campaignId) {
      params.set("campaign", campaignId);
    }

    // Add security token
    const token = this.generateViewToken(templateId, contactId);
    params.set("token", token);

    return `${this.baseUrl}/view?${params.toString()}`;
  }

  generateManagePreferencesUrl(contactId: string): string {
    const params = new URLSearchParams({
      c: contactId,
      action: "preferences",
      ts: Date.now().toString(),
    });

    const token = this.generateUnsubscribeToken(contactId);
    params.set("token", token);

    return `${this.baseUrl}/preferences?${params.toString()}`;
  }

  // Add UTM parameters to URLs
  addUtmParameters(
    url: string,
    campaignId?: string,
    medium?: string,
    source?: string
  ): string {
    try {
      const urlObj = new URL(url);

      if (this.config.utm_params) {
        if (this.config.utm_params.source || source) {
          urlObj.searchParams.set(
            "utm_source",
            source || this.config.utm_params.source!
          );
        }

        if (this.config.utm_params.medium || medium) {
          urlObj.searchParams.set(
            "utm_medium",
            medium || this.config.utm_params.medium!
          );
        }

        if (this.config.utm_params.campaign || campaignId) {
          urlObj.searchParams.set(
            "utm_campaign",
            campaignId || this.config.utm_params.campaign!
          );
        }

        if (this.config.utm_params.term) {
          urlObj.searchParams.set("utm_term", this.config.utm_params.term);
        }

        if (this.config.utm_params.content) {
          urlObj.searchParams.set(
            "utm_content",
            this.config.utm_params.content
          );
        }
      }

      return urlObj.toString();
    } catch (error) {
      console.warn("Failed to add UTM parameters to URL:", url, error);
      return url;
    }
  }

  // Generate tracking pixel HTML
  generateTrackingPixelHtml(
    templateId: string,
    contactId: string,
    campaignId?: string
  ): string {
    const pixelUrl = this.generatePixelUrl(templateId, contactId, campaignId);

    if (!pixelUrl) {
      return "";
    }

    return `<img src="${pixelUrl}" width="1" height="1" border="0" alt="" style="display:block;width:1px;height:1px;border:0;margin:0;padding:0;" />`;
  }

  // Generate unsubscribe footer HTML
  generateUnsubscribeFooterHtml(
    contactId: string,
    campaignId?: string,
    customText?: string
  ): string {
    const unsubscribeUrl = this.generateUnsubscribeUrl(contactId, campaignId);
    const preferencesUrl = this.generateManagePreferencesUrl(contactId);

    const defaultText =
      customText ||
      "You received this email because you subscribed to our mailing list.";

    return `
      <div style="margin-top: 40px; padding: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
        <p>${defaultText}</p>
        <p>
          <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
          | 
          <a href="${preferencesUrl}" style="color: #666; text-decoration: underline;">Manage Preferences</a>
        </p>
      </div>
    `;
  }

  // Generate company footer with address
  generateCompanyFooterHtml(
    companyName: string,
    companyAddress?: string
  ): string {
    return `
      <div style="margin-top: 20px; padding: 15px; font-size: 12px; color: #666; text-align: center;">
        <p><strong>${companyName}</strong></p>
        ${companyAddress ? `<p>${companyAddress}</p>` : ""}
      </div>
    `;
  }

  // Validate tracking URLs
  validateTrackingUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === new URL(this.baseUrl).hostname;
    } catch (error) {
      return false;
    }
  }

  // Parse tracking parameters from URL
  parseTrackingUrl(url: string): {
    templateId?: string;
    contactId?: string;
    campaignId?: string;
    event?: string;
    timestamp?: number;
    signature?: string;
  } {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      return {
        templateId: params.get("t") || undefined,
        contactId: params.get("c") || undefined,
        campaignId: params.get("campaign") || undefined,
        event: params.get("e") || undefined,
        timestamp: params.get("ts") ? parseInt(params.get("ts")!) : undefined,
        signature: params.get("s") || undefined,
      };
    } catch (error) {
      return {};
    }
  }

  // Private helper methods
  private generateSignature(data: string): string {
    // In production, use a proper HMAC with a secret key
    // This is a simple hash for demonstration
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private generateUnsubscribeToken(contactId: string): string {
    // Generate a secure token for unsubscribe links
    const timestamp = Date.now();
    const data = `unsubscribe:${contactId}:${timestamp}`;
    return this.generateSignature(data);
  }

  private generateViewToken(templateId: string, contactId: string): string {
    // Generate a secure token for view-in-browser links
    const timestamp = Date.now();
    const data = `view:${templateId}:${contactId}:${timestamp}`;
    return this.generateSignature(data);
  }
}

// Factory function to create tracking service with default config
export function createTrackingUrlService(
  baseUrl: string,
  customConfig?: Partial<TrackingConfig>
): TrackingUrlService {
  const defaultConfig: TrackingConfig = {
    pixel_enabled: true,
    click_tracking_enabled: true,
    open_tracking_enabled: true,
    utm_params: {
      source: "email",
      medium: "email",
    },
  };

  const config = { ...defaultConfig, ...customConfig };
  return new TrackingUrlService(baseUrl, config);
}

// Utility functions for common tracking scenarios
export class TrackingUtils {
  static extractEmailFromTrackingUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("email");
    } catch {
      return null;
    }
  }

  static isTrackingUrl(url: string, trackingDomain: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === trackingDomain;
    } catch {
      return false;
    }
  }

  static sanitizeRedirectUrl(
    url: string,
    allowedDomains?: string[]
  ): string | null {
    try {
      const urlObj = new URL(url);

      // Basic security check
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        return null;
      }

      // Check against allowed domains if provided
      if (allowedDomains && allowedDomains.length > 0) {
        const isAllowed = allowedDomains.some(
          (domain) =>
            urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
        );

        if (!isAllowed) {
          return null;
        }
      }

      return url;
    } catch {
      return null;
    }
  }
}
