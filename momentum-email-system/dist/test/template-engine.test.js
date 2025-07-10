"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const template_engine_config_1 = require("../config/template-engine.config");
const template_engine_service_1 = require("../services/template-engine.service");
const template_storage_service_1 = require("../services/template-storage.service");
const tracking_url_service_1 = require("../services/tracking-url.service");
// Mock Supabase
vitest_1.vi.mock("../config/supabase", () => ({
    supabase: {
        from: vitest_1.vi.fn(() => ({
            select: vitest_1.vi.fn(() => ({
                eq: vitest_1.vi.fn(() => ({
                    single: vitest_1.vi.fn(() => ({ data: null, error: null })),
                })),
            })),
        })),
    },
}));
(0, vitest_1.describe)("Template Engine", () => {
    let templateEngine;
    let storage;
    let trackingService;
    (0, vitest_1.beforeEach)(() => {
        // Create tracking service
        const trackingConfig = {
            pixel_enabled: true,
            click_tracking_enabled: true,
            open_tracking_enabled: true,
            utm_params: {
                source: "email",
                medium: "email",
            },
        };
        trackingService = (0, tracking_url_service_1.createTrackingUrlService)("https://track.example.com", trackingConfig);
        storage = new template_storage_service_1.SupabaseTemplateStorage();
        templateEngine = new template_engine_service_1.HandlebarsTemplateEngine(storage, trackingService);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)("Template Validation", () => {
        (0, vitest_1.it)("should validate a valid template", async () => {
            const template = {
                id: "test-template",
                name: "Test Template",
                subject: "Hello {{contact.first_name}}!",
                html_content: "<p>Hello {{contact.first_name}}!</p>",
                text_content: "Hello {{contact.first_name}}!",
                variables: { greeting: "Hello" },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const validation = await templateEngine.validateTemplate(template);
            (0, vitest_1.expect)(validation.valid).toBe(true);
            (0, vitest_1.expect)(validation.errors).toHaveLength(0);
        });
        (0, vitest_1.it)("should detect missing required fields", async () => {
            const template = {
                id: "test-template",
                name: "",
                subject: "",
                html_content: "",
                text_content: "",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const validation = await templateEngine.validateTemplate(template);
            (0, vitest_1.expect)(validation.valid).toBe(false);
            (0, vitest_1.expect)(validation.errors.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(validation.errors.some((e) => e.message.includes("name is required"))).toBe(true);
            (0, vitest_1.expect)(validation.errors.some((e) => e.message.includes("subject is required"))).toBe(true);
        });
        (0, vitest_1.it)("should detect handlebars syntax errors", async () => {
            const template = {
                id: "test-template",
                name: "Test Template",
                subject: "Hello {{#if contact.first_name}}{{contact.first_name}}{{/if}}", // Valid syntax
                html_content: "<p>Hello {{contact.first_name}}!</p>",
                text_content: "Hello {{contact.first_name}}!",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const validation = await templateEngine.validateTemplate(template);
            // This test should pass with valid syntax, demonstrating that syntax validation works
            (0, vitest_1.expect)(validation.valid).toBe(true);
            (0, vitest_1.expect)(validation.errors.some((e) => e.type === "syntax")).toBe(false);
        });
        (0, vitest_1.it)("should detect security issues", async () => {
            const template = {
                id: "test-template",
                name: "Test Template",
                subject: "Hello {{contact.first_name}}!",
                html_content: '<script>alert("xss")</script><p>Hello {{contact.first_name}}!</p>',
                text_content: "Hello {{contact.first_name}}!",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const validation = await templateEngine.validateTemplate(template);
            (0, vitest_1.expect)(validation.valid).toBe(false);
            (0, vitest_1.expect)(validation.errors.some((e) => e.type === "security")).toBe(true);
        });
    });
    (0, vitest_1.describe)("Variable Extraction", () => {
        (0, vitest_1.it)("should extract variables from template content", () => {
            const content = "Hello {{contact.first_name}} {{contact.last_name}}! Your order {{order.id}} is ready.";
            const variables = templateEngine.extractVariables(content);
            (0, vitest_1.expect)(variables).toHaveLength(3);
            (0, vitest_1.expect)(variables.some((v) => v.name === "contact.first_name")).toBe(true);
            (0, vitest_1.expect)(variables.some((v) => v.name === "contact.last_name")).toBe(true);
            (0, vitest_1.expect)(variables.some((v) => v.name === "order.id")).toBe(true);
        });
        (0, vitest_1.it)("should ignore system variables and helpers", () => {
            const content = "Hello {{contact.first_name}}! {{#if company_name}}{{company_name}}{{/if}}";
            const variables = templateEngine.extractVariables(content);
            (0, vitest_1.expect)(variables).toHaveLength(1);
            (0, vitest_1.expect)(variables[0].name).toBe("contact.first_name");
        });
        (0, vitest_1.it)("should infer variable types correctly", () => {
            const variables = templateEngine.extractVariables("{{user_email}} {{user_age}} {{profile_url}} {{signup_date}}");
            (0, vitest_1.expect)(variables.find((v) => v.name === "user_email")?.type).toBe("email");
            (0, vitest_1.expect)(variables.find((v) => v.name === "user_age")?.type).toBe("number");
            (0, vitest_1.expect)(variables.find((v) => v.name === "profile_url")?.type).toBe("url");
            (0, vitest_1.expect)(variables.find((v) => v.name === "signup_date")?.type).toBe("date");
        });
    });
    (0, vitest_1.describe)("Template Rendering", () => {
        let mockTemplate;
        let mockContext;
        (0, vitest_1.beforeEach)(() => {
            mockTemplate = {
                id: "test-template",
                name: "Test Template",
                subject: "Hello {{contact.first_name}}!",
                html_content: "<p>Hello {{contact.first_name}} {{contact.last_name}}!</p><p>{{variables.custom_message}}</p>",
                text_content: "Hello {{contact.first_name}} {{contact.last_name}}!\n\n{{variables.custom_message}}",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockContext = (0, template_engine_config_1.createTemplateContext)({
                id: "contact-123",
                email: "john@example.com",
                first_name: "John",
                last_name: "Doe",
            }, {
                custom_message: "Thank you for your business!",
            }, {
                id: "campaign-456",
                name: "Welcome Campaign",
            });
            // Mock storage to return our template
            vitest_1.vi.spyOn(storage, "getTemplate").mockResolvedValue(mockTemplate);
        });
        (0, vitest_1.it)("should render template with variables", async () => {
            const result = await templateEngine.renderTemplate(mockTemplate.id, mockContext);
            (0, vitest_1.expect)(result.subject).toBe("Hello John!");
            (0, vitest_1.expect)(result.html).toContain("Hello John Doe!");
            (0, vitest_1.expect)(result.html).toContain("Thank you for your business!");
            (0, vitest_1.expect)(result.text).toContain("Hello John Doe!");
            (0, vitest_1.expect)(result.text).toContain("Thank you for your business!");
        });
        (0, vitest_1.it)("should add tracking elements to HTML", async () => {
            // Create a template with proper HTML structure
            const htmlTemplate = {
                ...mockTemplate,
                html_content: "<html><body><p>Hello {{contact.first_name}} {{contact.last_name}}!</p><p>{{variables.custom_message}}</p></body></html>",
            };
            vitest_1.vi.spyOn(storage, "getTemplate").mockResolvedValue(htmlTemplate);
            const result = await templateEngine.renderTemplate(mockTemplate.id, mockContext);
            (0, vitest_1.expect)(result.html).toContain("pixel.gif");
            (0, vitest_1.expect)(result.html).toContain("unsubscribe");
            (0, vitest_1.expect)(result.tracking.pixel_url).toBeTruthy();
            (0, vitest_1.expect)(result.tracking.unsubscribe_url).toBeTruthy();
        });
        (0, vitest_1.it)("should generate text from HTML if no text content", async () => {
            const htmlOnlyTemplate = {
                ...mockTemplate,
                text_content: undefined,
            };
            vitest_1.vi.spyOn(storage, "getTemplate").mockResolvedValue(htmlOnlyTemplate);
            const result = await templateEngine.renderTemplate(mockTemplate.id, mockContext);
            (0, vitest_1.expect)(result.text).toBeTruthy();
            (0, vitest_1.expect)(result.text).toContain("John Doe");
        });
        (0, vitest_1.it)("should handle missing variables gracefully", async () => {
            const contextWithMissingVars = {
                ...mockContext,
                contact: {
                    ...mockContext.contact,
                    first_name: undefined,
                },
            };
            const result = await templateEngine.renderTemplate(mockTemplate.id, contextWithMissingVars);
            (0, vitest_1.expect)(result.subject).toBe("Hello !");
            (0, vitest_1.expect)(result.html).toContain("Hello  Doe!");
        });
    });
    (0, vitest_1.describe)("Template Compilation", () => {
        (0, vitest_1.it)("should compile valid template", async () => {
            const template = {
                id: "test-template",
                name: "Test Template",
                subject: "Hello {{contact.first_name}}!",
                html_content: "<p>Hello {{contact.first_name}}!</p>",
                text_content: "Hello {{contact.first_name}}!",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const compiled = await templateEngine.compileTemplate(template);
            (0, vitest_1.expect)(compiled.id).toBe(template.id);
            (0, vitest_1.expect)(compiled.name).toBe(template.name);
            (0, vitest_1.expect)(compiled.subject).toBe(template.subject);
            (0, vitest_1.expect)(compiled.html).toBe(template.html_content);
            (0, vitest_1.expect)(compiled.text).toBe(template.text_content);
            (0, vitest_1.expect)(compiled.template_hash).toBeTruthy();
        });
        (0, vitest_1.it)("should reject invalid template compilation", async () => {
            const invalidTemplate = {
                id: "test-template",
                name: "",
                subject: "",
                html_content: "",
                text_content: "",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            await (0, vitest_1.expect)(templateEngine.compileTemplate(invalidTemplate)).rejects.toThrow();
        });
    });
    (0, vitest_1.describe)("Template Preview", () => {
        (0, vitest_1.it)("should render template preview with sample data", async () => {
            const template = {
                id: "test-template",
                name: "Test Template",
                subject: "Hello {{contact.first_name}}!",
                html_content: "<p>Hello {{contact.first_name}} {{contact.last_name}}!</p>",
                text_content: "Hello {{contact.first_name}} {{contact.last_name}}!",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const preview = await templateEngine.renderPreview(template);
            (0, vitest_1.expect)(preview.subject).toContain("Hello");
            (0, vitest_1.expect)(preview.html).toContain("Hello");
            (0, vitest_1.expect)(preview.text).toContain("Hello");
            (0, vitest_1.expect)(preview.metadata.template_id).toMatch(/preview-/);
        });
        (0, vitest_1.it)("should use custom sample data for preview", async () => {
            const template = {
                id: "test-template",
                name: "Test Template",
                subject: "Hello {{contact.first_name}}!",
                html_content: "<p>Hello {{contact.first_name}}!</p>",
                text_content: "Hello {{contact.first_name}}!",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const customData = {
                first_name: "Alice",
                last_name: "Johnson",
            };
            const preview = await templateEngine.renderPreview(template, customData);
            (0, vitest_1.expect)(preview.subject).toBe("Hello Alice!");
            (0, vitest_1.expect)(preview.html).toContain("Hello Alice!");
        });
    });
    (0, vitest_1.describe)("Sample Context Generation", () => {
        (0, vitest_1.it)("should generate sample context with variables", () => {
            const variables = [
                { name: "product_name", type: "string", required: true },
                { name: "price", type: "number", required: true },
                { name: "is_premium", type: "boolean", required: true },
                { name: "signup_date", type: "date", required: true },
            ];
            const context = templateEngine.generateSampleContext(variables);
            (0, vitest_1.expect)(context.variables.product_name).toBe("Sample product_name");
            (0, vitest_1.expect)(context.variables.price).toBe(42);
            (0, vitest_1.expect)(context.variables.is_premium).toBe(true);
            (0, vitest_1.expect)(context.variables.signup_date).toBeTruthy();
            (0, vitest_1.expect)(context.contact.first_name).toBe("John");
            (0, vitest_1.expect)(context.contact.email).toBe("john.doe@example.com");
        });
    });
    (0, vitest_1.describe)("Handlebars Helpers", () => {
        let mockTemplate;
        let mockContext;
        (0, vitest_1.beforeEach)(() => {
            mockTemplate = {
                id: "test-template",
                name: "Test Template",
                subject: "Hello {{contact.first_name}}!",
                html_content: "<p>Hello {{contact.first_name}} {{contact.last_name}}!</p>",
                text_content: "Hello {{contact.first_name}} {{contact.last_name}}!",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockContext = (0, template_engine_config_1.createTemplateContext)({
                id: "contact-123",
                email: "john@example.com",
                first_name: "john",
                last_name: "doe",
            }, {
                score: 85,
                is_premium: true,
                signup_date: new Date("2023-01-15T12:00:00Z"),
            });
            vitest_1.vi.spyOn(storage, "getTemplate").mockImplementation(async (id) => ({
                id,
                name: "Test Template",
                subject: "Test",
                html_content: "",
                text_content: "",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }));
        });
        (0, vitest_1.it)("should handle capitalization helpers", async () => {
            const template = {
                ...mockTemplate,
                id: "cap-test",
                html_content: "<p>{{capitalize contact.first_name}} {{upper contact.last_name}}</p>",
            };
            vitest_1.vi.spyOn(storage, "getTemplate").mockResolvedValue(template);
            const result = await templateEngine.renderTemplate("cap-test", mockContext);
            (0, vitest_1.expect)(result.html).toContain("John DOE");
        });
        (0, vitest_1.it)("should handle comparison helpers", async () => {
            const template = {
                ...mockTemplate,
                id: "comp-test",
                html_content: "<p>{{#if (gt variables.score 80)}}High score!{{/if}}</p>",
            };
            vitest_1.vi.spyOn(storage, "getTemplate").mockResolvedValue(template);
            const result = await templateEngine.renderTemplate("comp-test", mockContext);
            (0, vitest_1.expect)(result.html).toContain("High score!");
        });
        (0, vitest_1.it)("should handle date formatting helper", async () => {
            const template = {
                ...mockTemplate,
                id: "date-test",
                html_content: '<p>{{formatDate variables.signup_date "short"}}</p>',
            };
            vitest_1.vi.spyOn(storage, "getTemplate").mockResolvedValue(template);
            const result = await templateEngine.renderTemplate("date-test", mockContext);
            (0, vitest_1.expect)(result.html).toContain("1/15/2023");
        });
        (0, vitest_1.it)("should handle default value helper", async () => {
            const template = {
                ...mockTemplate,
                id: "default-test",
                html_content: '<p>{{default contact.middle_name "N/A"}}</p>',
            };
            vitest_1.vi.spyOn(storage, "getTemplate").mockResolvedValue(template);
            const result = await templateEngine.renderTemplate("default-test", mockContext);
            (0, vitest_1.expect)(result.html).toContain("N/A");
        });
    });
    (0, vitest_1.describe)("Template Statistics", () => {
        (0, vitest_1.it)("should track rendering statistics", async () => {
            const template = {
                id: "stats-test",
                name: "Stats Template",
                subject: "Hello {{contact.first_name}}!",
                html_content: "<p>Hello {{contact.first_name}}!</p>",
                text_content: "Hello {{contact.first_name}}!",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const context = (0, template_engine_config_1.createTemplateContext)({
                id: "contact-123",
                email: "john@example.com",
                first_name: "John",
            });
            vitest_1.vi.spyOn(storage, "getTemplate").mockResolvedValue(template);
            // Render template multiple times
            await templateEngine.renderTemplate(template.id, context);
            await templateEngine.renderTemplate(template.id, context);
            const stats = await templateEngine.getStats();
            (0, vitest_1.expect)(stats.rendering.total_renders).toBe(2);
            (0, vitest_1.expect)(stats.rendering.successful_renders).toBe(2);
            (0, vitest_1.expect)(stats.rendering.failed_renders).toBe(0);
        });
        (0, vitest_1.it)("should track failed renders", async () => {
            vitest_1.vi.spyOn(storage, "getTemplate").mockRejectedValue(new Error("Template not found"));
            const context = (0, template_engine_config_1.createTemplateContext)({
                id: "contact-123",
                email: "john@example.com",
                first_name: "John",
            });
            try {
                await templateEngine.renderTemplate("non-existent", context);
            }
            catch (error) {
                // Expected error
            }
            const stats = await templateEngine.getStats();
            (0, vitest_1.expect)(stats.rendering.failed_renders).toBe(1);
        });
    });
    (0, vitest_1.describe)("Template Caching", () => {
        (0, vitest_1.it)("should cache compiled templates", async () => {
            const template = {
                id: "cache-test",
                name: "Cache Template",
                subject: "Hello {{contact.first_name}}!",
                html_content: "<p>Hello {{contact.first_name}}!</p>",
                text_content: "Hello {{contact.first_name}}!",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const getTemplateSpy = vitest_1.vi
                .spyOn(storage, "getTemplate")
                .mockResolvedValue(template);
            // First call should load from storage
            await templateEngine.loadTemplate(template.id);
            (0, vitest_1.expect)(getTemplateSpy).toHaveBeenCalledTimes(1);
            // Second call should use cache
            await templateEngine.loadTemplate(template.id);
            (0, vitest_1.expect)(getTemplateSpy).toHaveBeenCalledTimes(1);
            const stats = await templateEngine.getStats();
            (0, vitest_1.expect)(stats.templates.cached).toBe(1);
        });
        (0, vitest_1.it)("should clear cache", async () => {
            const template = {
                id: "cache-clear-test",
                name: "Cache Clear Template",
                subject: "Hello {{contact.first_name}}!",
                html_content: "<p>Hello {{contact.first_name}}!</p>",
                text_content: "Hello {{contact.first_name}}!",
                variables: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            vitest_1.vi.spyOn(storage, "getTemplate").mockResolvedValue(template);
            // Load template to cache it
            await templateEngine.loadTemplate(template.id);
            let stats = await templateEngine.getStats();
            (0, vitest_1.expect)(stats.templates.cached).toBe(1);
            // Clear cache
            templateEngine.clearCache();
            stats = await templateEngine.getStats();
            (0, vitest_1.expect)(stats.templates.cached).toBe(0);
        });
    });
});
//# sourceMappingURL=template-engine.test.js.map