// fix-users.js - Standalone script to populate users table
// Save this file in your project root and run: node fix-users.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Your Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL || 'https://nrohcrnoazrudrhfetse.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yb2hjcm5vYXpydWRyaGZldHNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Mjc0MDM0NSwiZXhwIjoyMDU4MzE2MzQ1fQ.4u3Hlnm-pvaeJIh4hVARdMkZn0qInqPrMrR5tWWz6hk';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUsersTable() {
  console.log('🔧 Starting users table fix...');
  
  try {
    // Step 1: Get all users from Supabase Auth
    console.log('📊 Fetching users from Supabase Auth...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    console.log(`📊 Found ${authUsers.users.length} users in Supabase Auth`);
    
    if (authUsers.users.length === 0) {
      console.log('ℹ️  No users found in Supabase Auth');
      return;
    }
    
    // Step 2: Check current users table
    console.log('🔍 Checking current users table...');
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id');
    
    if (checkError) {
      console.error('❌ Error checking users table:', checkError);
      return;
    }
    
    console.log(`📊 Found ${existingUsers?.length || 0} users in users table`);
    
    // Step 3: Prepare users for insertion
    console.log('🔄 Determining user roles...');
    
    const usersToInsert = await Promise.all(authUsers.users.map(async (user) => {
      // Check if user is admin based on metadata
      const isAdminByMetadata = 
        (user?.user_metadata?.is_admin === true) || 
        (user?.app_metadata?.role === 'admin');
      
      // Check profiles table for admin status
      let isAdminByProfile = false;
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role, is_admin')
          .eq('id', user.id)
          .single();
        
        isAdminByProfile = 
          profileData?.is_admin === true || profileData?.role === 'admin';
      } catch (error) {
        // Profile might not exist, that's okay
      }
      
      const role = (isAdminByMetadata || isAdminByProfile) ? 'admin' : 'user';
      
      return {
        id: user.id,
        email: user.email || '',
        role: role,
        created_at: user.created_at || new Date().toISOString()
      };
    }));
    
    const adminCount = usersToInsert.filter(u => u.role === 'admin').length;
    const userCount = usersToInsert.filter(u => u.role === 'user').length;
    
    console.log(`📊 Role distribution: ${adminCount} admins, ${userCount} users`);
    
    console.log(`📝 Preparing to insert/update ${usersToInsert.length} users...`);
    
    // Step 4: Insert users into the users table
    const { data, error } = await supabase
      .from('users')
      .upsert(usersToInsert, {
        onConflict: 'id'
      });
    
    if (error) {
      console.error('❌ Error inserting users:', error);
      return;
    }
    
    console.log(`✅ Successfully processed ${usersToInsert.length} users`);
    
    // Step 5: Verify the insertion
    console.log('🔍 Verifying users table...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('users')
      .select('id, email, role, created_at');
    
    if (verifyError) {
      console.error('❌ Error verifying users:', verifyError);
      return;
    }
    
    const finalAdminCount = verifyData?.filter(u => u.role === 'admin').length || 0;
    const finalUserCount = verifyData?.filter(u => u.role === 'user').length || 0;
    
    console.log(`✅ Users table now contains ${verifyData?.length || 0} users`);
    console.log(`📊 Final distribution: ${finalAdminCount} admins, ${finalUserCount} users`);
    
    // Show sample users
    if (verifyData && verifyData.length > 0) {
      console.log('\n📋 Sample users in table:');
      verifyData.slice(0, 5).forEach(user => {
        console.log(`   - ${user.email} (${user.role}) - ${user.id.substring(0, 8)}...`);
      });
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('💡 You can now create chat sessions without foreign key errors');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

// Run the fix
console.log('🚀 Starting Mindful AI Users Table Fix');
console.log('=====================================\n');

fixUsersTable()
  .then(() => {
    console.log('\n🏁 Script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });