import { CampaignLog, CampaignStats, CleanupResult, CreateEmailQueue, EmailQueue, HandleBounceResult, LogLevel, ProcessQueueResult, RateLimit, StartCampaignResult, UpdateEmailStatusResult } from "../types/email-system";
export declare class EmailQueueService {
    getEmailQueue(limit?: number, offset?: number): Promise<EmailQueue[]>;
    getQueueForCampaign(campaignId: string): Promise<EmailQueue[]>;
    addToQueue(queueItem: CreateEmailQueue): Promise<EmailQueue>;
    updateQueueStatus(queueId: string, status: string, errorMessage?: string): Promise<EmailQueue>;
    processEmailQueue(batchSize?: number): Promise<ProcessQueueResult>;
    startCampaign(campaignId: string): Promise<StartCampaignResult>;
    updateEmailStatus(messageId: string, status: string, trackingData?: Record<string, any>): Promise<UpdateEmailStatusResult>;
    getCampaignStats(campaignId: string): Promise<CampaignStats>;
    handleBounce(email: string, reason: string): Promise<HandleBounceResult>;
    getCampaignLogs(campaignId?: string, level?: LogLevel, limit?: number): Promise<CampaignLog[]>;
    logCampaignEvent(campaignId: string | null, level: LogLevel, message: string, metadata?: Record<string, any>): Promise<any>;
    checkRateLimit(limitKey: string, maxCount?: number, windowMinutes?: number): Promise<boolean>;
    getRateLimits(): Promise<RateLimit[]>;
    cleanupOldData(daysOld?: number): Promise<CleanupResult>;
    getSystemStats(): Promise<{
        contacts: {
            total: number;
            active: number;
        };
        campaigns: {
            total: number;
            running: number;
        };
        queue: {
            pending: number;
            failed: number;
        };
        rateLimits: any;
    }>;
    bulkUpdateQueueStatus(queueIds: string[], status: string, errorMessage?: string): Promise<EmailQueue[]>;
    retryFailedEmails(campaignId: string, maxAttempts?: number): Promise<EmailQueue[]>;
    cancelCampaignQueue(campaignId: string): Promise<EmailQueue[]>;
    getDashboardMetrics(): Promise<{
        recentActivity: CampaignLog[];
        canSendEmails: boolean;
        lastUpdated: string;
        contacts: {
            total: number;
            active: number;
        };
        campaigns: {
            total: number;
            running: number;
        };
        queue: {
            pending: number;
            failed: number;
        };
        rateLimits: any;
    }>;
    handleMailtrapWebhook(webhookData: any): Promise<UpdateEmailStatusResult>;
}
