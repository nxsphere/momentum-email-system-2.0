import "dotenv/config";
import { supabase } from "./src/config/supabase";

async function deepStatusCheck() {
  try {
    console.log('🔍 Deep status check - multiple counting methods...\n');

    // Method 1: Simple count
    console.log('Method 1: Simple count query...');
    const { count: count1, error: error1 } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true });

    if (error1) {
      console.log('  ❌ Error:', error1.message);
    } else {
      console.log('  ✅ Result:', count1);
    }

    // Method 2: Count all with pagination
    console.log('\nMethod 2: Pagination count...');
    let total = 0;
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('contacts')
        .select('id')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.log('  ❌ Error on page', page, ':', error.message);
        break;
      }

      if (!data || data.length === 0) break;

      total += data.length;
      console.log(`  📄 Page ${page + 1}: ${data.length} contacts (total so far: ${total})`);
      page++;

      if (data.length < pageSize) break;
    }

    console.log('  ✅ Total via pagination:', total);

    // Method 3: Check recent additions
    console.log('\nMethod 3: Recent contact timeline...');
    const { data: recentData, error: recentError } = await supabase
      .from('contacts')
      .select('email, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.log('  ❌ Error:', recentError.message);
    } else {
      console.log('  📅 Last 10 contacts:');
      recentData?.forEach((contact, index) => {
        console.log(`     ${index + 1}. ${contact.email} (${new Date(contact.created_at).toLocaleString()})`);
      });
    }

    // Method 4: Status breakdown with all statuses
    console.log('\nMethod 4: Complete status breakdown...');
    const { data: allStatuses, error: statusError } = await supabase
      .from('contacts')
      .select('status, created_at')
      .order('created_at', { ascending: false });

    if (statusError) {
      console.log('  ❌ Error:', statusError.message);
    } else {
      const statusCounts = allStatuses?.reduce((acc, contact) => {
        acc[contact.status] = (acc[contact.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      console.log('  📊 All statuses:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`     ${status}: ${count}`);
      });
      console.log(`  📈 Grand total: ${allStatuses?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    process.exit(0);
  }
}

deepStatusCheck();
