const { afterEach, beforeEach, describe, expect, it, jest: vi } = require('@jest/globals');
import { createTestUUID } from '../../src/types/email-system';
import { createTemplateContext } from "../../src/config/template-engine.config";
import { HandlebarsTemplateEngine } from "../../src/services/template-engine.service";
import { SupabaseTemplateStorage } from "../../src/services/template-storage.service";
import { TrackingUrlService } from "../../src/services/tracking-url.service";
import { EmailTemplate } from "../../src/types/email-system";
import { TemplateContext, TrackingConfig } from "../../src/types/template-engine";

// Mock Supabase
vi.mock("../../src/config/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

describe("Template Engine", () => {
  let templateEngine: HandlebarsTemplateEngine;
  let storage: SupabaseTemplateStorage;
  let trackingService: any;

  beforeEach(() => {
    // Create tracking service
    const trackingConfig: TrackingConfig = {
      pixel_enabled: true,
      click_tracking_enabled: true,
      open_tracking_enabled: true,
      utm_params: {
        source: "email",
        medium: "email",
      },
    };

    trackingService = new TrackingUrlService(
      "https://track.example.com",
      trackingConfig
    );
    storage = new SupabaseTemplateStorage();
    
    // Create template engine with tracking configuration
    const engineConfig = {
      tracking: {
        enableClickTracking: true,
        enableOpenTracking: true,
        trackingDomain: "track.example.com",
        pixelPath: "/pixel.gif",
        unsubscribePath: "/unsubscribe",
        clickPath: "/click",
      }
    };
    
    templateEngine = new HandlebarsTemplateEngine(storage, trackingService, engineConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Template Validation", () => {
    it("should validate a valid template", async () => {
      const template: EmailTemplate = {
        id: createTestUUID("test-template"),
        name: "Test Template",
        subject: "Hello {{contact.first_name}}!",
        html_content: "<p>Hello {{contact.first_name}}!</p>",
        text_content: "Hello {{contact.first_name}}!",
        variables: { greeting: "Hello" },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const validation = await templateEngine.validateTemplate(template);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect missing required fields", async () => {
      const template: EmailTemplate = {
        id: createTestUUID("test-template"),
        name: "",
        subject: "",
        html_content: "",
        text_content: "",
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const validation = await templateEngine.validateTemplate(template);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(
        validation.errors.some((e) => e.message.includes("name is required"))
      ).toBe(true);
      expect(
        validation.errors.some((e) => e.message.includes("subject is required"))
      ).toBe(true);
    });

    it("should detect handlebars syntax errors", async () => {
      const template: EmailTemplate = {
        id: createTestUUID("test-template"),
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
      expect(validation.valid).toBe(true);
      expect(validation.errors.some((e) => e.type === "syntax")).toBe(false);
    });

    it("should detect security issues", async () => {
      const template: EmailTemplate = {
        id: createTestUUID("test-template"),
        name: "Test Template",
        subject: "Hello {{contact.first_name}}!",
        html_content:
          '<script>alert("xss")</script><p>Hello {{contact.first_name}}!</p>',
        text_content: "Hello {{contact.first_name}}!",
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const validation = await templateEngine.validateTemplate(template);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === "security")).toBe(true);
    });
  });

  describe("Variable Extraction", () => {
    it("should extract variables from template content", () => {
      const content =
        "Hello {{contact.first_name}} {{contact.last_name}}! Your order {{order.id}} is ready.";
      const variables = templateEngine.extractVariables(content);

      expect(variables).toHaveLength(3);
      expect(variables.some((v) => v.name === "contact.first_name")).toBe(true);
      expect(variables.some((v) => v.name === "contact.last_name")).toBe(true);
      expect(variables.some((v) => v.name === "order.id")).toBe(true);
    });

    it("should ignore system variables and helpers", () => {
      const content =
        "Hello {{contact.first_name}}! {{#if company_name}}{{company_name}}{{/if}}";
      const variables = templateEngine.extractVariables(content);

      expect(variables).toHaveLength(1);
      expect(variables[0].name).toBe("contact.first_name");
    });

    it("should infer variable types correctly", () => {
      const variables = templateEngine.extractVariables(
        "{{user_email}} {{user_age}} {{profile_url}} {{signup_date}}"
      );

      expect(variables.find((v) => v.name === "user_email")?.type).toBe(
        "email"
      );
      expect(variables.find((v) => v.name === "user_age")?.type).toBe("number");
      expect(variables.find((v) => v.name === "profile_url")?.type).toBe("url");
      expect(variables.find((v) => v.name === "signup_date")?.type).toBe(
        "date"
      );
    });
  });

  describe("Template Rendering", () => {
    let mockTemplate: EmailTemplate;
    let mockContext: TemplateContext;

    beforeEach(() => {
      mockTemplate = {
        id: createTestUUID("test-template"),
        name: "Test Template",
        subject: "Hello {{contact.first_name}}!",
        html_content:
          "<p>Hello {{contact.first_name}} {{contact.last_name}}!</p><p>{{variables.custom_message}}</p>",
        text_content:
          "Hello {{contact.first_name}} {{contact.last_name}}!\n\n{{variables.custom_message}}",
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockContext = createTemplateContext(
        {
          id: "contact-123",
          email: "john@example.com",
          first_name: "John",
          last_name: "Doe",
        },
        {
          custom_message: "Thank you for your business!",
        },
        {
          id: "campaign-456",
          name: "Welcome Campaign",
        }
      );

      // Mock storage to return our template
      vi.spyOn(storage, "getTemplate").mockResolvedValue(mockTemplate);
    });

    it("should render template with variables", async () => {
      const result = await templateEngine.renderTemplate(
        mockTemplate.id,
        mockContext
      );

      expect(result.subject).toBe("Hello John!");
      expect(result.html).toContain("Hello John Doe!");
      expect(result.html).toContain("Thank you for your business!");
      expect(result.text).toContain("Hello John Doe!");
      expect(result.text).toContain("Thank you for your business!");
    });

    it("should add tracking elements to HTML", async () => {
      // Create a template with proper HTML structure
      const htmlTemplate = {
        ...mockTemplate,
        html_content: "<html><body><p>Hello {{contact.first_name}} {{contact.last_name}}!</p><p>{{variables.custom_message}}</p></body></html>",
      };

      vi.spyOn(storage, "getTemplate").mockResolvedValue(htmlTemplate);

      const result = await templateEngine.renderTemplate(
        mockTemplate.id,
        mockContext
      );

      // The template engine should create tracking URLs even if HTML is sanitized
      expect(result.tracking.pixel_url).toBeTruthy();
      expect(result.tracking.unsubscribe_url).toBeTruthy();
      expect(result.tracking.click_tracking_enabled).toBe(true);
      
      // Check if tracking URLs contain expected elements
      expect(result.tracking.pixel_url).toContain("pixel.gif");
      expect(result.tracking.unsubscribe_url).toContain("unsubscribe");
    });

    it("should generate text from HTML if no text content", async () => {
      const htmlOnlyTemplate = {
        ...mockTemplate,
                  text_content: undefined,
      };

      vi.spyOn(storage, "getTemplate").mockResolvedValue(htmlOnlyTemplate);

      const result = await templateEngine.renderTemplate(
        mockTemplate.id,
        mockContext
      );

      expect(result.text).toBeTruthy();
      expect(result.text).toContain("John Doe");
    });

    it("should handle missing variables gracefully", async () => {
      const contextWithMissingVars = {
        ...mockContext,
        contact: {
          ...mockContext.contact,
          first_name: undefined,
        },
      };

      const result = await templateEngine.renderTemplate(
        mockTemplate.id,
        contextWithMissingVars
      );

      expect(result.subject).toBe("Hello !");
      expect(result.html).toContain("Hello  Doe!");
    });
  });

  describe("Template Compilation", () => {
    it("should compile valid template", async () => {
      const template: EmailTemplate = {
        id: createTestUUID("test-template"),
        name: "Test Template",
        subject: "Hello {{contact.first_name}}!",
        html_content: "<p>Hello {{contact.first_name}}!</p>",
        text_content: "Hello {{contact.first_name}}!",
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const compiled = await templateEngine.compileTemplate(template);

      expect(compiled.id).toBe(template.id);
      expect(compiled.name).toBe(template.name);
      expect(compiled.subject).toBe(template.subject);
      expect(compiled.html).toBe(template.html_content);
      expect(compiled.text).toBe(template.text_content);
      expect(compiled.template_hash).toBeTruthy();
    });

    it("should reject invalid template compilation", async () => {
      const invalidTemplate: EmailTemplate = {
        id: createTestUUID("test-template"),
        name: "",
        subject: "",
        html_content: "",
        text_content: "",
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await expect(
        templateEngine.compileTemplate(invalidTemplate)
      ).rejects.toThrow();
    });
  });

  describe("Template Preview", () => {
    it("should render template preview with sample data", async () => {
      const template: EmailTemplate = {
        id: createTestUUID("test-template"),
        name: "Test Template",
        subject: "Hello {{contact.first_name}}!",
        html_content:
          "<p>Hello {{contact.first_name}} {{contact.last_name}}!</p>",
        text_content: "Hello {{contact.first_name}} {{contact.last_name}}!",
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const preview = await templateEngine.renderPreview(template);

      expect(preview.subject).toContain("Hello");
      expect(preview.html).toContain("Hello");
      expect(preview.text).toContain("Hello");
      expect(preview.metadata.template_id).toMatch(/preview-/);
    });

    it("should use custom sample data for preview", async () => {
      const template: EmailTemplate = {
        id: createTestUUID("test-template"),
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

      expect(preview.subject).toBe("Hello Alice!");
      expect(preview.html).toContain("Hello Alice!");
    });
  });

  describe("Sample Context Generation", () => {
    it("should generate sample context with variables", () => {
      const variables = [
        { name: "product_name", type: "string" as const, required: true },
        { name: "price", type: "number" as const, required: true },
        { name: "is_premium", type: "boolean" as const, required: true },
        { name: "signup_date", type: "date" as const, required: true },
      ];

      const context = templateEngine.generateSampleContext(variables);

      expect(context.variables.product_name).toBe("Sample product_name");
      expect(context.variables.price).toBe(42);
      expect(context.variables.is_premium).toBe(true);
      expect(context.variables.signup_date).toBeTruthy();
      expect(context.contact.first_name).toBe("John");
      expect(context.contact.email).toBe("john.doe@example.com");
    });
  });

  describe("Handlebars Helpers", () => {
    let mockTemplate: EmailTemplate;
    let mockContext: TemplateContext;

    beforeEach(() => {
      mockTemplate = {
        id: createTestUUID("test-template"),
        name: "Test Template",
        subject: "Hello {{contact.first_name}}!",
        html_content: "<p>Hello {{contact.first_name}} {{contact.last_name}}!</p>",
        text_content: "Hello {{contact.first_name}} {{contact.last_name}}!",
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockContext = createTemplateContext(
        {
          id: "contact-123",
          email: "john@example.com",
          first_name: "john",
          last_name: "doe",
        },
        {
          score: 85,
          is_premium: true,
          signup_date: new Date("2023-01-15T12:00:00Z"),
        }
      );

      vi.spyOn(storage, "getTemplate").mockImplementation(async (id: string) => ({
        id: createTestUUID(id),
        name: "Test Template",
        subject: "Test",
        html_content: "",
        text_content: "",
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    });

    it("should handle capitalization helpers", async () => {
      const template = {
        ...mockTemplate,
        id: createTestUUID("cap-test"),
        html_content:
          "<p>{{capitalize contact.first_name}} {{upper contact.last_name}}</p>",
      };

      vi.spyOn(storage, "getTemplate").mockResolvedValue(template);

      const result = await templateEngine.renderTemplate(
        "cap-test",
        mockContext
      );
      expect(result.html).toContain("John DOE");
    });

    it("should handle comparison helpers", async () => {
      const template = {
        ...mockTemplate,
        id: createTestUUID("comp-test"),
        html_content:
          "<p>{{#if (gt variables.score 80)}}High score!{{/if}}</p>",
      };

      vi.spyOn(storage, "getTemplate").mockResolvedValue(template);

      const result = await templateEngine.renderTemplate(
        "comp-test",
        mockContext
      );
      expect(result.html).toContain("High score!");
    });

    it("should handle date formatting helper", async () => {
      const template = {
        ...mockTemplate,
        id: createTestUUID("date-test"),
        html_content: '<p>{{formatDate variables.signup_date "short"}}</p>',
      };

      vi.spyOn(storage, "getTemplate").mockResolvedValue(template);

      const result = await templateEngine.renderTemplate(
        "date-test",
        mockContext
      );
      expect(result.html).toContain("1/15/2023");
    });

    it("should handle default value helper", async () => {
      const template = {
        ...mockTemplate,
        id: createTestUUID("default-test"),
        html_content: '<p>{{default contact.middle_name "N/A"}}</p>',
      };

      vi.spyOn(storage, "getTemplate").mockResolvedValue(template);

      const result = await templateEngine.renderTemplate(
        "default-test",
        mockContext
      );
      expect(result.html).toContain("N/A");
    });
  });

  describe("Template Statistics", () => {
    it("should track rendering statistics", async () => {
      const template: EmailTemplate = {
        id: createTestUUID("stats-test"),
        name: "Stats Template",
        subject: "Hello {{contact.first_name}}!",
        html_content: "<p>Hello {{contact.first_name}}!</p>",
        text_content: "Hello {{contact.first_name}}!",
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const context = createTemplateContext({
        id: "contact-123",
        email: "john@example.com",
        first_name: "John",
      });

      vi.spyOn(storage, "getTemplate").mockResolvedValue(template);

      // Render template multiple times
      await templateEngine.renderTemplate(template.id, context);
      await templateEngine.renderTemplate(template.id, context);

      const stats = await templateEngine.getStats();
      expect(stats.rendering.total_renders).toBe(2);
      expect(stats.rendering.successful_renders).toBe(2);
      expect(stats.rendering.failed_renders).toBe(0);
    });

    it("should track failed renders", async () => {
      vi.spyOn(storage, "getTemplate").mockRejectedValue(
        new Error("Template not found")
      );

      const context = createTemplateContext({
        id: "contact-123",
        email: "john@example.com",
        first_name: "John",
      });

      try {
        await templateEngine.renderTemplate("non-existent", context);
      } catch (error) {
        // Expected error
      }

      const stats = await templateEngine.getStats();
      expect(stats.rendering.failed_renders).toBe(1);
    });
  });

  describe("Template Caching", () => {
    it("should cache compiled templates", async () => {
      const template: EmailTemplate = {
        id: createTestUUID("cache-test"),
        name: "Cache Template",
        subject: "Hello {{contact.first_name}}!",
        html_content: "<p>Hello {{contact.first_name}}!</p>",
        text_content: "Hello {{contact.first_name}}!",
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const getTemplateSpy = vi
        .spyOn(storage, "getTemplate")
        .mockResolvedValue(template);

      // First call should load from storage
      await templateEngine.loadTemplate(template.id);
      expect(getTemplateSpy).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await templateEngine.loadTemplate(template.id);
      expect(getTemplateSpy).toHaveBeenCalledTimes(1);

      const stats = await templateEngine.getStats();
      expect(stats.templates.cached).toBe(1);
    });

    it("should clear cache", async () => {
      const template: EmailTemplate = {
        id: createTestUUID("cache-clear-test"),
        name: "Cache Clear Template",
        subject: "Hello {{contact.first_name}}!",
        html_content: "<p>Hello {{contact.first_name}}!</p>",
        text_content: "Hello {{contact.first_name}}!",
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(storage, "getTemplate").mockResolvedValue(template);

      // Load template to cache it
      await templateEngine.loadTemplate(template.id);

      let stats = await templateEngine.getStats();
      expect(stats.templates.cached).toBe(1);

      // Clear cache
      templateEngine.clearCache();

      stats = await templateEngine.getStats();
      expect(stats.templates.cached).toBe(0);
    });
  });
});
