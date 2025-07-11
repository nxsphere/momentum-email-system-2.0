import "dotenv/config";
import { supabase } from "./src/config/supabase";

async function checkStatus() {
  try {
    console.log('📊 Checking contact database status...\n');

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error getting count:', countError.message);
      return;
    }

    console.log(`✅ Total contacts in database: ${totalCount || 0}`);

    // Get status breakdown
    const { data: statusData, error: statusError } = await supabase
      .from('contacts')
      .select('status')
      .order('status');

    if (statusError) {
      console.error('Error getting status breakdown:', statusError.message);
      return;
    }

    // Count by status
    const statusCounts = statusData?.reduce((acc, contact) => {
      acc[contact.status] = (acc[contact.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    console.log('\n📋 Status breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    // Get recent imports
    const { data: recentData, error: recentError } = await supabase
      .from('contacts')
      .select('email, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      console.error('Error getting recent contacts:', recentError.message);
      return;
    }

    console.log('\n🕒 Most recent contacts:');
    recentData?.forEach((contact, index) => {
      console.log(`   ${index + 1}. ${contact.email} (${new Date(contact.created_at).toLocaleString()})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkStatus();
