"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UUID = void 0;
// UUID utility functions
exports.UUID = {
    /**
     * Validates if a string is a valid UUID format
     */
    isValid(value) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value);
    },
    /**
     * Creates a UUID type from a validated string
     */
    from(value) {
        if (!exports.UUID.isValid(value)) {
            throw new Error(`Invalid UUID format: ${value}`);
        }
        return value;
    },
    /**
     * Creates a UUID type from any string (for testing)
     */
    fromString(value) {
        return value;
    },
    /**
     * Generates a new UUID (requires external uuid library)
     */
    generate() {
        // This would use the uuid library in practice
        // For now, return a placeholder type-safe UUID
        return crypto.randomUUID();
    }
};
//# sourceMappingURL=email-provider.js.map