// Script to test authentication flow: registration, login, and session management

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - replace with actual values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAuthFlow() {
  console.log('Testing authentication flow...\n');
  
  // Generate a unique email for testing
  const testEmail = `test-user-${Date.now()}@example.com`;
  const testPassword = 'test-password-123';

  try {
    // 1. Test user registration
    console.log('1. Testing user registration...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError) {
      console.error('Registration failed:', signUpError.message);
      return;
    }

    console.log('✅ Registration successful');
    console.log('User ID:', signUpData.user.id);
    console.log('Confirmation sent:', signUpData.user.confirmation_sent_at ? 'Yes' : 'No');

    // 2. Test login
    console.log('\n2. Testing login...');
    // Wait a moment for confirmation (in real scenario, user would click confirmation link)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      console.error('Login failed:', signInError.message);
      return;
    }

    console.log('✅ Login successful');
    console.log('User ID:', signInData.user.id);
    console.log('Session token:', signInData.session?.access_token ? 'Received' : 'Not received');

    // 3. Test session management
    console.log('\n3. Testing session management...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session check failed:', sessionError.message);
    } else if (sessionData.session) {
      console.log('✅ Session active');
      console.log('Session expires at:', new Date(sessionData.session.expires_at * 1000).toISOString());
    } else {
      console.log('❌ No active session');
    }

    // 4. Test protected data access
    console.log('\n4. Testing protected data access...');
    const { data: userData, error: userError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('id', signInData.user.id)
      .single();

    if (userError && userError.code === 'PGRST116') {
      console.log('❌ Access denied (as expected for new user with viewer role)');
    } else if (userError) {
      console.error('Error accessing user data:', userError.message);
    } else {
      console.log('✅ User data accessed successfully');
      console.log('User role:', userData.role);
    }

    // 5. Test logout
    console.log('\n5. Testing logout...');
    const { error: signOutError } = await supabase.auth.signOut();
    
    if (signOutError) {
      console.error('Logout failed:', signOutError.message);
    } else {
      console.log('✅ Logout successful');
    }

    // 6. Verify session is destroyed
    console.log('\n6. Verifying session is destroyed...');
    const { data: sessionAfterLogout, error: sessionCheckError } = await supabase.auth.getSession();
    
    if (sessionCheckError) {
      console.error('Session check failed:', sessionCheckError.message);
    } else if (!sessionAfterLogout.session) {
      console.log('✅ Session properly destroyed');
    } else {
      console.log('❌ Session still active after logout');
    }

  } catch (error) {
    console.error('Unexpected error during authentication flow test:', error.message);
  }
}

// Run the test
testAuthFlow();