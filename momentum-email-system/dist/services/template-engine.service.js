"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandlebarsTemplateEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const handlebars_1 = __importDefault(require("handlebars"));
const html_to_text_1 = require("html-to-text");
const uuid_1 = require("uuid");
const dompurify_1 = __importDefault(require("dompurify"));
// In-memory cache implementation with proper LRU eviction
class MemoryTemplateCache {
    constructor(maxSize = 100, maxMemoryMB = 50) {
        this.cache = new Map();
        this.accessOrder = new Map(); // Track access order for LRU
        this.currentMemoryBytes = 0;
        this.accessCounter = 0;
        this.maxSize = maxSize;
        this.maxMemoryBytes = maxMemoryMB * 1024 * 1024; // Convert MB to bytes
    }
    get(templateId) {
        const template = this.cache.get(templateId);
        if (template) {
            // Update access order for LRU
            this.accessOrder.set(templateId, ++this.accessCounter);
            return template;
        }
        return null;
    }
    set(templateId, template) {
        // Calculate template memory usage
        const templateSize = this.calculateTemplateSize(template);
        // Check if template is too large for cache
        if (templateSize > this.maxMemoryBytes * 0.5) {
            console.warn(`Template ${templateId} is too large for cache (${templateSize} bytes)`);
            return;
        }
        // Remove old template if it exists
        if (this.cache.has(templateId)) {
            const oldTemplate = this.cache.get(templateId);
            this.currentMemoryBytes -= this.calculateTemplateSize(oldTemplate);
        }
        // Evict templates if necessary - batch eviction for efficiency
        while ((this.cache.size >= this.maxSize ||
            this.currentMemoryBytes + templateSize > this.maxMemoryBytes) &&
            this.cache.size > 0) {
            // Batch evict multiple templates to prevent memory spikes
            const evictCount = Math.max(1, Math.floor(this.cache.size * 0.1)); // Evict 10% at a time
            for (let i = 0; i < evictCount && this.cache.size > 0; i++) {
                this.evictLeastRecentlyUsed();
            }
            // Safety check to prevent infinite loops
            if (this.currentMemoryBytes + templateSize > this.maxMemoryBytes && this.cache.size === 0) {
                console.warn(`Template ${templateId} too large even after clearing cache. Size: ${templateSize} bytes, Limit: ${this.maxMemoryBytes} bytes`);
                return;
            }
        }
        // Add new template
        this.cache.set(templateId, template);
        this.accessOrder.set(templateId, ++this.accessCounter);
        this.currentMemoryBytes += templateSize;
        // Log memory usage if approaching limits
        if (this.currentMemoryBytes > this.maxMemoryBytes * 0.8) {
            console.warn(`Template cache memory usage high: ${Math.round(this.currentMemoryBytes / 1024 / 1024)}MB / ${Math.round(this.maxMemoryBytes / 1024 / 1024)}MB`);
        }
    }
    invalidate(templateId) {
        const template = this.cache.get(templateId);
        if (template) {
            this.currentMemoryBytes -= this.calculateTemplateSize(template);
            this.cache.delete(templateId);
            this.accessOrder.delete(templateId);
        }
    }
    clear() {
        this.cache.clear();
        this.accessOrder.clear();
        this.currentMemoryBytes = 0;
        this.accessCounter = 0;
    }
    size() {
        return this.cache.size;
    }
    /**
     * Get cache statistics for monitoring
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            memoryUsageMB: Math.round((this.currentMemoryBytes / 1024 / 1024) * 100) / 100,
            maxMemoryMB: Math.round((this.maxMemoryBytes / 1024 / 1024) * 100) / 100,
            memoryUtilization: Math.round((this.currentMemoryBytes / this.maxMemoryBytes) * 100),
        };
    }
    evictLeastRecentlyUsed() {
        let lruTemplateId = null;
        let lruAccessTime = Number.MAX_SAFE_INTEGER;
        // Find least recently used template
        for (const [templateId, accessTime] of this.accessOrder.entries()) {
            if (accessTime < lruAccessTime) {
                lruAccessTime = accessTime;
                lruTemplateId = templateId;
            }
        }
        if (lruTemplateId) {
            console.debug(`Evicting LRU template from cache: ${lruTemplateId}`);
            this.invalidate(lruTemplateId);
        }
    }
    calculateTemplateSize(template) {
        // Estimate memory usage of template
        const jsonString = JSON.stringify(template);
        return jsonString.length * 2; // Approximate bytes (UTF-16)
    }
}
class HandlebarsTemplateEngine {
    constructor(storage, trackingService, config) {
        this.storage = storage;
        this.trackingService = trackingService;
        this.cache = new MemoryTemplateCache();
        this.handlebars = handlebars_1.default.create();
        // Default configuration
        this.config = {
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
                ],
                blockedHelpers: ["eval", "exec", "require"],
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
            ...config,
        };
        this.stats = {
            templates: { total: 0, valid: 0, invalid: 0, cached: 0 },
            rendering: {
                total_renders: 0,
                successful_renders: 0,
                failed_renders: 0,
                average_render_time: 0,
            },
            validation: { syntax_errors: 0, variable_errors: 0, security_errors: 0 },
        };
        this.setupHandlebarsHelpers();
    }
    /**
     * Sanitize HTML content to prevent XSS attacks
     */
    sanitizeHtml(html) {
        if (!this.config.security.sanitizeHtml) {
            return html;
        }
        try {
            // Configure DOMPurify for email-safe HTML
            const cleanHtml = dompurify_1.default.sanitize(html, {
                ALLOWED_TAGS: [
                    'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'i', 'img', 'li', 'ol', 'p', 'span', 'strong', 'table', 'tbody',
                    'td', 'th', 'thead', 'tr', 'ul', 'font', 'center'
                ],
                ALLOWED_ATTR: [
                    'href', 'src', 'alt', 'title', 'width', 'height', 'style',
                    'color', 'size', 'face', 'align', 'border', 'cellpadding',
                    'cellspacing', 'bgcolor', 'class', 'id'
                ],
                ALLOW_DATA_ATTR: false,
                FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
            });
            return cleanHtml;
        }
        catch (error) {
            console.warn('HTML sanitization failed, removing all HTML:', error);
            // Fallback: strip all HTML if sanitization fails
            return html.replace(/<[^>]*>/g, '');
        }
    }
    /**
     * Sanitize template context variables to prevent XSS
     */
    sanitizeContext(context) {
        if (!this.config.security.sanitizeHtml) {
            return context;
        }
        const sanitizedContext = JSON.parse(JSON.stringify(context)); // Deep clone
        // Sanitize contact information
        if (sanitizedContext.contact.first_name) {
            sanitizedContext.contact.first_name = this.sanitizeString(sanitizedContext.contact.first_name);
        }
        if (sanitizedContext.contact.last_name) {
            sanitizedContext.contact.last_name = this.sanitizeString(sanitizedContext.contact.last_name);
        }
        if (sanitizedContext.contact.full_name) {
            sanitizedContext.contact.full_name = this.sanitizeString(sanitizedContext.contact.full_name);
        }
        // Sanitize metadata recursively
        if (sanitizedContext.contact.metadata) {
            sanitizedContext.contact.metadata = this.sanitizeObject(sanitizedContext.contact.metadata);
        }
        // Sanitize campaign metadata
        if (sanitizedContext.campaign?.metadata) {
            sanitizedContext.campaign.metadata = this.sanitizeObject(sanitizedContext.campaign.metadata);
        }
        // Sanitize custom variables
        sanitizedContext.variables = this.sanitizeObject(sanitizedContext.variables);
        return sanitizedContext;
    }
    /**
     * Sanitize a string value
     */
    sanitizeString(value) {
        if (typeof value !== 'string') {
            return String(value);
        }
        // Remove potentially dangerous characters
        return value
            .replace(/[<>'"&]/g, (char) => {
            const entityMap = {
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '&': '&amp;'
            };
            return entityMap[char];
        })
            .substring(0, 1000); // Limit length to prevent DoS
    }
    /**
     * Recursively sanitize an object
     */
    sanitizeObject(obj) {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            // Sanitize the key itself
            const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
            if (typeof value === 'string') {
                sanitized[cleanKey] = this.sanitizeString(value);
            }
            else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                sanitized[cleanKey] = this.sanitizeObject(value);
            }
            else if (Array.isArray(value)) {
                sanitized[cleanKey] = value.map(item => typeof item === 'string' ? this.sanitizeString(item) : item).slice(0, 100); // Limit array size
            }
            else {
                // Numbers, booleans, null, etc. are safe
                sanitized[cleanKey] = value;
            }
        }
        return sanitized;
    }
    async loadTemplate(templateId) {
        // Check cache first
        const cached = this.cache.get(templateId);
        if (cached) {
            return cached;
        }
        // Load from storage
        const template = await this.storage.getTemplate(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        // Compile and cache
        const compiled = await this.compileTemplate(template);
        this.cache.set(templateId, compiled);
        return compiled;
    }
    async renderTemplate(templateId, context) {
        const startTime = Date.now();
        this.stats.rendering.total_renders++;
        try {
            const compiledTemplate = await this.loadTemplate(templateId);
            // Validate context has required variables
            await this.validateContextVariables(compiledTemplate, context);
            // Sanitize context to prevent XSS attacks
            const sanitizedContext = this.sanitizeContext(context);
            // Enhance context with system variables
            const enhancedContext = this.enhanceContext(sanitizedContext, templateId);
            // Render subject
            const subjectTemplate = this.handlebars.compile(compiledTemplate.subject);
            const renderedSubject = subjectTemplate(enhancedContext);
            // Render HTML
            let renderedHtml = "";
            if (compiledTemplate.html) {
                const htmlTemplate = this.handlebars.compile(compiledTemplate.html);
                renderedHtml = htmlTemplate(enhancedContext);
                // Apply additional HTML sanitization to the final output
                renderedHtml = this.sanitizeHtml(renderedHtml);
                renderedHtml = this.processHtmlTracking(renderedHtml, templateId, context);
            }
            // Render or generate text
            let renderedText = "";
            if (compiledTemplate.text) {
                const textTemplate = this.handlebars.compile(compiledTemplate.text);
                renderedText = textTemplate(enhancedContext);
            }
            else if (renderedHtml) {
                renderedText = this.generateTextFromHtml(renderedHtml);
            }
            const renderTime = Date.now() - startTime;
            this.updateRenderingStats(renderTime, true);
            return {
                subject: renderedSubject,
                html: renderedHtml,
                text: renderedText,
                tracking: {
                    pixel_url: enhancedContext.system.tracking_pixel_url,
                    unsubscribe_url: enhancedContext.system.unsubscribe_url,
                    click_tracking_enabled: this.config.tracking.enableClickTracking,
                },
                metadata: {
                    template_id: templateId,
                    contact_id: context.contact.id,
                    campaign_id: context.campaign?.id,
                    rendered_at: new Date(),
                    variables_used: this.extractUsedVariables(compiledTemplate, enhancedContext),
                },
            };
        }
        catch (error) {
            const renderTime = Date.now() - startTime;
            this.updateRenderingStats(renderTime, false);
            throw error;
        }
    }
    async validateTemplate(template) {
        const errors = [];
        const warnings = [];
        const variables = [];
        try {
            // Basic validation
            if (!template.name?.trim()) {
                errors.push({
                    type: "compilation",
                    message: "Template name is required",
                });
            }
            if (!template.subject?.trim()) {
                errors.push({
                    type: "compilation",
                    message: "Template subject is required",
                });
            }
            if (!template.html_content && !template.text_content) {
                errors.push({
                    type: "compilation",
                    message: "Template must have either HTML or text content",
                });
            }
            // Size validation
            const htmlSize = template.html_content?.length || 0;
            const textSize = template.text_content?.length || 0;
            if (htmlSize > this.config.security.maxTemplateSize) {
                errors.push({
                    type: "security",
                    message: `HTML content exceeds maximum size limit (${this.config.security.maxTemplateSize} bytes)`,
                });
            }
            if (textSize > this.config.security.maxTemplateSize) {
                errors.push({
                    type: "security",
                    message: `Text content exceeds maximum size limit (${this.config.security.maxTemplateSize} bytes)`,
                });
            }
            // Syntax validation
            if (this.config.validation.enableSyntaxCheck) {
                const syntaxValidation = this.validateHandlebarsSyntax(template);
                errors.push(...syntaxValidation.errors);
                warnings.push(...syntaxValidation.warnings);
                variables.push(...syntaxValidation.variables);
            }
            // Security validation
            if (this.config.validation.enableSecurityCheck) {
                const securityValidation = this.validateSecurity(template);
                errors.push(...securityValidation.errors);
                warnings.push(...securityValidation.warnings);
            }
            // Update stats
            if (errors.length > 0) {
                this.stats.templates.invalid++;
                errors.forEach((error) => {
                    switch (error.type) {
                        case "syntax":
                            this.stats.validation.syntax_errors++;
                            break;
                        case "missing_variable":
                            this.stats.validation.variable_errors++;
                            break;
                        case "security":
                            this.stats.validation.security_errors++;
                            break;
                    }
                });
            }
            else {
                this.stats.templates.valid++;
            }
            return {
                valid: errors.length === 0,
                errors,
                warnings,
                variables,
            };
        }
        catch (error) {
            return {
                valid: false,
                errors: [
                    {
                        type: "compilation",
                        message: `Validation failed: ${error}`,
                    },
                ],
                warnings: [],
                variables: [],
            };
        }
    }
    async compileTemplate(template) {
        const validation = await this.validateTemplate(template);
        if (!validation.valid) {
            const errorMessages = validation.errors.map((e) => e.message).join(", ");
            throw new Error(`Template compilation failed: ${errorMessages}`);
        }
        // Generate template hash for cache invalidation
        const content = [
            template.subject,
            template.html_content,
            template.text_content,
        ].join("|");
        const templateHash = crypto_1.default.createHash("md5").update(content).digest("hex");
        return {
            id: template.id,
            name: template.name,
            subject: template.subject,
            html: template.html_content || "",
            text: template.text_content || "",
            variables: validation.variables,
            compiled_at: new Date(),
            template_hash: templateHash,
        };
    }
    async precompileTemplates(templateIds) {
        const promises = templateIds.map((id) => this.loadTemplate(id).catch((error) => {
            console.warn(`Failed to precompile template ${id}:`, error);
        }));
        await Promise.all(promises);
    }
    async renderPreview(template, sampleData) {
        const variables = this.extractVariables(template.html_content || template.text_content || "");
        const sampleContext = this.generateSampleContext(variables);
        // Override with provided sample data
        if (sampleData) {
            Object.assign(sampleContext.variables, sampleData);
            if (sampleData.first_name)
                sampleContext.contact.first_name = sampleData.first_name;
            if (sampleData.last_name)
                sampleContext.contact.last_name = sampleData.last_name;
            if (sampleData.email)
                sampleContext.contact.email = sampleData.email;
        }
        // Use temporary template ID for preview
        const tempTemplate = {
            id: `preview-${(0, uuid_1.v4)()}`,
            name: template.name,
            subject: template.subject,
            html: template.html_content || "",
            text: template.text_content || "",
            variables,
            compiled_at: new Date(),
            template_hash: "preview",
        };
        // Cache temporarily
        this.cache.set(tempTemplate.id, tempTemplate);
        try {
            const result = await this.renderTemplate(tempTemplate.id, sampleContext);
            return result;
        }
        finally {
            // Clean up preview template from cache
            this.cache.invalidate(tempTemplate.id);
        }
    }
    extractVariables(templateContent) {
        const variables = [];
        const found = new Set();
        // Prevent DoS attacks by limiting content size
        if (templateContent.length > 100000) { // 100KB limit
            throw new Error('Template content too large for variable extraction');
        }
        // Use safer regex pattern that prevents ReDoS
        const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.]{0,100})\s*\}\}/g;
        let match;
        let matchCount = 0;
        const maxMatches = 1000; // Prevent infinite loops
        while ((match = variablePattern.exec(templateContent)) !== null && matchCount < maxMatches) {
            matchCount++;
            const variableName = match[1].trim();
            // Additional safety checks
            if (variableName.length > 100)
                continue; // Skip overly long variable names
            if (variableName.includes('..'))
                continue; // Skip potentially malicious patterns
            // Skip Handlebars helpers and system variables
            if (this.isSystemVariable(variableName) ||
                this.isHandlebarsHelper(variableName)) {
                continue;
            }
            if (!found.has(variableName)) {
                found.add(variableName);
                variables.push({
                    name: variableName,
                    type: this.inferVariableType(variableName),
                    required: false, // Make variables optional by default
                });
            }
        }
        if (matchCount >= maxMatches) {
            console.warn(`Variable extraction stopped at ${maxMatches} matches to prevent DoS`);
        }
        return variables;
    }
    generateSampleContext(variables) {
        const sampleVariables = {};
        variables.forEach((variable) => {
            sampleVariables[variable.name] = this.generateSampleValue(variable);
        });
        return {
            contact: {
                id: "sample-contact-id",
                email: "john.doe@example.com",
                first_name: "John",
                last_name: "Doe",
                full_name: "John Doe",
                metadata: {},
            },
            campaign: {
                id: "sample-campaign-id",
                name: "Sample Campaign",
                metadata: {},
            },
            system: {
                unsubscribe_url: "https://example.com/unsubscribe?token=sample",
                tracking_pixel_url: "https://example.com/pixel.gif?t=sample",
                view_in_browser_url: "https://example.com/view?token=sample",
                company_name: "Sample Company",
                company_address: "123 Sample St, Sample City, SC 12345",
                current_date: new Date().toLocaleDateString(),
                current_year: new Date().getFullYear(),
            },
            variables: sampleVariables,
        };
    }
    async getStats() {
        this.stats.templates.cached = this.cache.size();
        this.stats.templates.total =
            this.stats.templates.valid + this.stats.templates.invalid;
        return { ...this.stats };
    }
    clearCache() {
        this.cache.clear();
    }
    // Private helper methods
    setupHandlebarsHelpers() {
        // Custom helpers for email templates
        this.handlebars.registerHelper("eq", (a, b) => a === b);
        this.handlebars.registerHelper("ne", (a, b) => a !== b);
        this.handlebars.registerHelper("gt", (a, b) => a > b);
        this.handlebars.registerHelper("lt", (a, b) => a < b);
        this.handlebars.registerHelper("and", (a, b) => a && b);
        this.handlebars.registerHelper("or", (a, b) => a || b);
        this.handlebars.registerHelper("not", (a) => !a);
        // Date formatting helper
        this.handlebars.registerHelper("formatDate", (date, format) => {
            const d = new Date(date);
            if (format === "short")
                return d.toLocaleDateString();
            if (format === "long")
                return d.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                });
            return d.toISOString();
        });
        // Capitalization helpers
        this.handlebars.registerHelper("capitalize", (str) => {
            if (!str)
                return "";
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        });
        this.handlebars.registerHelper("upper", (str) => str?.toUpperCase() || "");
        this.handlebars.registerHelper("lower", (str) => str?.toLowerCase() || "");
        // URL helpers
        this.handlebars.registerHelper("urlEncode", (str) => encodeURIComponent(str || ""));
        // Default value helper
        this.handlebars.registerHelper("default", (value, defaultValue) => value || defaultValue);
    }
    validateHandlebarsSyntax(template) {
        const errors = [];
        const warnings = [];
        const variables = [];
        const contents = [
            { type: "subject", content: template.subject },
            { type: "html", content: template.html_content },
            { type: "text", content: template.text_content },
        ];
        contents.forEach(({ type, content }) => {
            if (!content)
                return;
            try {
                // Try to compile to check syntax
                this.handlebars.compile(content);
                // Extract variables
                const contentVariables = this.extractVariables(content);
                variables.push(...contentVariables);
            }
            catch (error) {
                errors.push({
                    type: "syntax",
                    message: `Handlebars syntax error in ${type}: ${error}`,
                    context: type,
                });
            }
        });
        return { errors, warnings, variables };
    }
    validateSecurity(template) {
        const errors = [];
        const warnings = [];
        // Check for script tags
        const scriptPattern = /<script[^>]*>.*?<\/script>/gi;
        const onEventPattern = /\s+on\w+\s*=/gi;
        const javascriptPattern = /javascript\s*:/gi;
        const contents = [
            template.html_content || "",
            template.text_content || "",
            template.subject || ""
        ];
        contents.forEach((content, index) => {
            const contentType = index === 0 ? "HTML" : index === 1 ? "text" : "subject";
            // Check for script tags
            if (!this.config.security.allowScriptTags && scriptPattern.test(content)) {
                errors.push({
                    type: "security",
                    message: `Script tags are not allowed in ${contentType} content`,
                });
            }
            // Check for event handlers (onclick, onload, etc.)
            if (onEventPattern.test(content)) {
                errors.push({
                    type: "security",
                    message: `JavaScript event handlers are not allowed in ${contentType} content`,
                });
            }
            // Check for javascript: URLs
            if (javascriptPattern.test(content)) {
                errors.push({
                    type: "security",
                    message: `JavaScript URLs are not allowed in ${contentType} content`,
                });
            }
            // Check for potentially dangerous HTML entities
            const dangerousEntities = /&#x[0-9a-f]+;|&#[0-9]+;/gi;
            if (dangerousEntities.test(content)) {
                warnings.push({
                    type: "security",
                    message: `Potentially dangerous HTML entities found in ${contentType} content`,
                });
            }
            // Check for data URLs (could be used for XSS)
            const dataUrlPattern = /data\s*:\s*[^,]*,/gi;
            if (dataUrlPattern.test(content)) {
                warnings.push({
                    type: "security",
                    message: `Data URLs found in ${contentType} content - please verify they are safe`,
                });
            }
        });
        // Check blocked helpers
        this.config.validation.blockedHelpers.forEach((helper) => {
            const helperPattern = new RegExp(`{{\\s*${helper}\\s+`, "gi");
            if (helperPattern.test(template.html_content || "")) {
                errors.push({
                    type: "security",
                    message: `Blocked helper '${helper}' is not allowed`,
                });
            }
        });
        return { errors, warnings };
    }
    enhanceContext(context, templateId) {
        return {
            ...context,
            system: {
                ...context.system,
                tracking_pixel_url: this.trackingService.generatePixelUrl(templateId, context.contact.id, context.campaign?.id),
                unsubscribe_url: this.trackingService.generateUnsubscribeUrl(context.contact.id, context.campaign?.id),
                view_in_browser_url: this.trackingService.generateViewInBrowserUrl(templateId, context.contact.id, context.campaign?.id),
            },
        };
    }
    processHtmlTracking(html, templateId, context) {
        let processedHtml = html;
        // Add tracking pixel
        if (this.config.tracking.enableOpenTracking) {
            const pixelHtml = this.trackingService.generateTrackingPixelHtml(templateId, context.contact.id, context.campaign?.id);
            processedHtml = processedHtml.replace("</body>", `${pixelHtml}</body>`);
        }
        // Process click tracking
        if (this.config.tracking.enableClickTracking) {
            const linkPattern = /<a\s+([^>]*href\s*=\s*["']?)([^"'\s>]+)(["']?[^>]*)>/gi;
            processedHtml = processedHtml.replace(linkPattern, (match, prefix, url, suffix) => {
                // Skip if already a tracking URL or anchor link
                if (url.startsWith("#") ||
                    url.includes("track.") ||
                    url.includes("unsubscribe")) {
                    return match;
                }
                const trackingUrl = this.trackingService.generateClickTrackingUrl(url, templateId, context.contact.id, context.campaign?.id);
                return `<a ${prefix}${trackingUrl}${suffix}>`;
            });
        }
        // Add unsubscribe footer if not present
        if (!processedHtml.includes("unsubscribe") &&
            !processedHtml.includes("Unsubscribe")) {
            const footerHtml = this.trackingService.generateUnsubscribeFooterHtml(context.contact.id, context.campaign?.id);
            processedHtml = processedHtml.replace("</body>", `${footerHtml}</body>`);
        }
        return processedHtml;
    }
    generateTextFromHtml(html) {
        return (0, html_to_text_1.convert)(html, {
            wordwrap: this.config.textGeneration.wordwrap,
            preserveNewlines: this.config.textGeneration.preserveLineBreaks,
        });
    }
    async validateContextVariables(template, context) {
        const requiredVariables = template.variables.filter((v) => v.required);
        const missingVariables = [];
        requiredVariables.forEach((variable) => {
            const value = this.getVariableValue(variable.name, context);
            if (value === undefined || value === null || value === "") {
                missingVariables.push(variable.name);
            }
        });
        if (missingVariables.length > 0) {
            throw new Error(`Missing required variables: ${missingVariables.join(", ")}`);
        }
    }
    getVariableValue(variableName, context) {
        // Check in different context sections
        if (context.variables[variableName] !== undefined) {
            return context.variables[variableName];
        }
        if (context.contact[variableName] !==
            undefined) {
            return context.contact[variableName];
        }
        if (context.campaign?.[variableName] !==
            undefined) {
            return context.campaign[variableName];
        }
        if (context.system[variableName] !== undefined) {
            return context.system[variableName];
        }
        return undefined;
    }
    extractUsedVariables(template, context) {
        return template.variables
            .filter((variable) => this.getVariableValue(variable.name, context) !== undefined)
            .map((variable) => variable.name);
    }
    isSystemVariable(variableName) {
        const systemVars = [
            "unsubscribe_url",
            "tracking_pixel_url",
            "view_in_browser_url",
            "company_name",
            "company_address",
            "current_date",
            "current_year",
        ];
        return systemVars.includes(variableName);
    }
    isHandlebarsHelper(variableName) {
        const helpers = [
            "if",
            "unless",
            "each",
            "with",
            "#if",
            "#unless",
            "#each",
            "#with",
            "/if",
            "/unless",
            "/each",
            "/with",
        ];
        // Check for custom helpers
        const customHelpers = [
            "capitalize",
            "upper",
            "lower",
            "formatDate",
            "default",
            "eq",
            "ne",
            "gt",
            "lt",
            "and",
            "or",
            "not",
            "urlEncode",
        ];
        // Check if it starts with a helper name followed by a space
        const startsWithHelper = [...helpers, ...customHelpers].some(helper => variableName.startsWith(helper + " ") || variableName === helper);
        return startsWithHelper || helpers.some((helper) => variableName.includes(helper));
    }
    inferVariableType(variableName) {
        const lowerName = variableName.toLowerCase();
        if (lowerName.includes("email"))
            return "email";
        if (lowerName.includes("url") || lowerName.includes("link"))
            return "url";
        if (lowerName.includes("date") || lowerName.includes("time"))
            return "date";
        if (lowerName.includes("count") ||
            lowerName.includes("number") ||
            lowerName.includes("age"))
            return "number";
        if (lowerName.includes("is_") ||
            lowerName.includes("has_") ||
            lowerName.includes("enabled"))
            return "boolean";
        return "string";
    }
    generateSampleValue(variable) {
        switch (variable.type) {
            case "email":
                return "sample@example.com";
            case "url":
                return "https://example.com";
            case "date":
                return new Date().toISOString();
            case "number":
                return 42;
            case "boolean":
                return true;
            default:
                return `Sample ${variable.name}`;
        }
    }
    updateRenderingStats(renderTime, success) {
        if (success) {
            this.stats.rendering.successful_renders++;
        }
        else {
            this.stats.rendering.failed_renders++;
        }
        // Update average render time
        const totalRenders = this.stats.rendering.successful_renders +
            this.stats.rendering.failed_renders;
        this.stats.rendering.average_render_time =
            (this.stats.rendering.average_render_time * (totalRenders - 1) +
                renderTime) /
                totalRenders;
    }
}
exports.HandlebarsTemplateEngine = HandlebarsTemplateEngine;
//# sourceMappingURL=template-engine.service.js.map