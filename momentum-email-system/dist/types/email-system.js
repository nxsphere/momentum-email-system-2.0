"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestUUID = exports.UUID = void 0;
// Re-export UUID for use in other modules
var email_provider_1 = require("./email-provider");
Object.defineProperty(exports, "UUID", { enumerable: true, get: function () { return email_provider_1.UUID; } });
// Helper function to convert string to UUID for tests
const createTestUUID = (value) => value;
exports.createTestUUID = createTestUUID;
//# sourceMappingURL=email-system.js.map