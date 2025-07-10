import { EmailService } from "../services/email.service";
import { EmailServiceOptions, MailtrapConfig } from "../types/email-provider";
export interface EmailConfig {
    mailtrap: MailtrapConfig;
    service: EmailServiceOptions;
}
export declare function createEmailConfig(): EmailConfig;
export declare function createEmailService(): EmailService;
export declare function validateEmailConfig(): {
    valid: boolean;
    errors: string[];
};
export declare const emailService: EmailService;
