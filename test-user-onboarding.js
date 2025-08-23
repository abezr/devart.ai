// Script to test PostgreSQL trigger activation and user role creation

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - replace with actual values
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testUserOnboarding() {
  console.log('Testing PostgreSQL trigger activation and user role creation...\n');

  try {
    // Create a test user
    console.log('1. Creating a test user...');
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: 'test-user-' + Date.now() + '@example.com',
      password: 'test-password-123',
    });

    if (authError) {
      console.error('Error creating user:', authError.message);
      return;
    }

    console.log('User created successfully with ID:', authUser.user.id);

    // Wait a moment for the trigger to execute
    console.log('Waiting for trigger to execute...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if the user role was created
    console.log('2. Checking if user role was created...');
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('id', authUser.user.id)
      .single();

    if (roleError) {
      console.error('Error fetching user role:', roleError.message);
    } else if (userRole) {
      console.log('✅ User role created successfully:', userRole);
    } else {
      console.log('❌ User role not found for the created user');
    }

    // Check the get_my_role function
    console.log('3. Testing get_my_role function...');
    const { data: role, error: roleFuncError } = await supabase.rpc('get_my_role');
    
    if (roleFuncError) {
      console.error('Error calling get_my_role function:', roleFuncError.message);
    } else {
      console.log('get_my_role function result:', role);
    }

    // Clean up test user (if possible)
    console.log('4. Cleaning up test user...');
    // Note: We can't directly delete the user from the auth.users table
    // This would typically be done through the Supabase dashboard or auth.admin

  } catch (error) {
    console.error('Unexpected error during testing:', error.message);
  }
}

// Run the test
testUserOnboarding();