"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
require("dotenv/config");
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
    },
});
// Test the connection
// const _testConnection = async () => {
//   try {
//     const { data: _data, error } = await supabase
//       .from("contacts")
//       .select("*")
//       .limit(1);
//     if (error) throw error;
//     console.log("✅ Connected to Supabase successfully");
//   } catch (error) {
//     console.error("❌ Error connecting to Supabase:", error);
//   }
// };
// Uncomment to test connection on import
// testConnection();
//# sourceMappingURL=supabase.js.map