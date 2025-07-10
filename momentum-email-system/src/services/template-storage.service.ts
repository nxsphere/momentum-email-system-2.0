import { supabase } from "../config/supabase";
import { EmailTemplate } from "../types/email-system";
import {
    TemplateStorage,
    TemplateValidationResult,
} from "../types/template-engine";

export class SupabaseTemplateStorage implements TemplateStorage {
  async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned
          return null;
        }
        throw new Error(`Failed to get template: ${error.message}`);
      }

      return data as EmailTemplate;
    } catch (error) {
      console.error("Error getting template:", error);
      throw error;
    }
  }

  async getTemplateByName(name: string): Promise<EmailTemplate | null> {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("name", name)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned
          return null;
        }
        throw new Error(`Failed to get template by name: ${error.message}`);
      }

      return data as EmailTemplate;
    } catch (error) {
      console.error("Error getting template by name:", error);
      throw error;
    }
  }

  async saveTemplate(template: Partial<EmailTemplate>): Promise<EmailTemplate> {
    try {
      const templateData = {
        name: template.name,
        subject: template.subject,
        html_content: template.html_content,
        text_content: template.text_content,
        variables: template.variables || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("email_templates")
        .insert(templateData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save template: ${error.message}`);
      }

      return data as EmailTemplate;
    } catch (error) {
      console.error("Error saving template:", error);
      throw error;
    }
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<EmailTemplate>
  ): Promise<EmailTemplate> {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Remove undefined values
      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      const { data, error } = await supabase
        .from("email_templates")
        .update(updateData)
        .eq("id", templateId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update template: ${error.message}`);
      }

      return data as EmailTemplate;
    } catch (error) {
      console.error("Error updating template:", error);
      throw error;
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", templateId);

      if (error) {
        throw new Error(`Failed to delete template: ${error.message}`);
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      throw error;
    }
  }

  async listTemplates(limit = 100, offset = 0): Promise<EmailTemplate[]> {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to list templates: ${error.message}`);
      }

      return (data || []) as EmailTemplate[];
    } catch (error) {
      console.error("Error listing templates:", error);
      throw error;
    }
  }

  async validateTemplate(
    templateId: string
  ): Promise<TemplateValidationResult> {
    try {
      const template = await this.getTemplate(templateId);

      if (!template) {
        return {
          valid: false,
          errors: [
            {
              type: "compilation",
              message: `Template with ID ${templateId} not found`,
            },
          ],
          warnings: [],
          variables: [],
        };
      }

      // Basic validation - this will be enhanced by the template engine
      const errors: any[] = [];
      const warnings: any[] = [];

      if (!template.name || template.name.trim() === "") {
        errors.push({
          type: "compilation",
          message: "Template name is required",
        });
      }

      if (!template.subject || template.subject.trim() === "") {
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

      // Check for extremely large templates
      const htmlSize = template.html_content?.length || 0;
      const textSize = template.text_content?.length || 0;
      const maxSize = 500000; // 500KB

      if (htmlSize > maxSize || textSize > maxSize) {
        warnings.push({
          type: "performance",
          message: "Template size is very large and may impact performance",
        });
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        variables: this.extractBasicVariables(template),
      };
    } catch (error) {
      console.error("Error validating template:", error);
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

  private extractBasicVariables(template: EmailTemplate): any[] {
    const variables: any[] = [];

    // Extract variables from template.variables if it exists
    if (template.variables && typeof template.variables === "object") {
      Object.entries(template.variables).forEach(([key, value]) => {
        variables.push({
          name: key,
          type: this.inferVariableType(value),
          required: true,
          defaultValue: value,
        });
      });
    }

    return variables;
  }

  private inferVariableType(value: any): string {
    if (typeof value === "string") {
      if (value.includes("@")) return "email";
      if (value.startsWith("http")) return "url";
      return "string";
    }
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (value instanceof Date) return "date";
    return "string";
  }

  // Template search functionality with SQL injection protection
  async searchTemplates(query: string, limit = 50): Promise<EmailTemplate[]> {
    try {
      // Input validation and sanitization
      if (!query || typeof query !== 'string') {
        return [];
      }

      // Sanitize query: remove SQL special characters and limit length
      const sanitizedQuery = query
        .replace(/[%_\\]/g, '\\$&') // Escape SQL wildcards
        .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, hyphens
        .trim()
        .substring(0, 100); // Limit length to prevent DoS

      if (sanitizedQuery.length === 0) {
        return [];
      }

      // Use safe separate queries to avoid SQL injection
      // Query 1: Search by name
      const { data: nameResults, error: nameError } = await supabase
        .from("email_templates")
        .select("*")
        .ilike("name", `%${sanitizedQuery}%`)
        .order("created_at", { ascending: false })
        .limit(Math.min(limit, 100));

      // Query 2: Search by subject  
      const { data: subjectResults, error: subjectError } = await supabase
        .from("email_templates")
        .select("*")
        .ilike("subject", `%${sanitizedQuery}%`)
        .order("created_at", { ascending: false })
        .limit(Math.min(limit, 100));

      if (nameError) {
        throw new Error(`Failed to search templates by name: ${nameError.message}`);
      }
      if (subjectError) {
        throw new Error(`Failed to search templates by subject: ${subjectError.message}`);
      }

      // Combine and deduplicate results
      const allResults = [...(nameResults || []), ...(subjectResults || [])];
      const uniqueResults = allResults.filter((template, index, self) => 
        index === self.findIndex(t => t.id === template.id)
      );

      // Sort by created_at and limit
      const data = uniqueResults
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, Math.min(limit, 100));

      return data as EmailTemplate[];
    } catch (error) {
      console.error("Error searching templates:", error);
      throw error;
    }
  }

  // Template usage tracking
  async incrementUsageCount(templateId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc("increment_template_usage", {
        template_id: templateId,
      });

      if (error) {
        console.warn(
          "Failed to increment template usage count:",
          error.message
        );
        // Don't throw error as this is not critical functionality
      }
    } catch (error) {
      console.warn("Error incrementing template usage:", error);
    }
  }

  // Get template statistics
  async getTemplateStats(_templateId: string): Promise<{
    usage_count: number;
    last_used: string | null;
    campaigns_using: number;
  }> {
    try {
      // This would require additional tables/tracking
      // For now, return basic structure
      return {
        usage_count: 0,
        last_used: null,
        campaigns_using: 0,
      };
    } catch (error) {
      console.error("Error getting template stats:", error);
      return {
        usage_count: 0,
        last_used: null,
        campaigns_using: 0,
      };
    }
  }
}
