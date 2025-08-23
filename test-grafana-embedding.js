// Script to test Grafana panel embedding and CORS configuration

const GRAFANA_URL = 'http://localhost:3001';
const NEXT_APP_URL = 'http://localhost:3000'; // Next.js application URL

async function testGrafanaEmbedding() {
  console.log('Testing Grafana panel embedding and CORS configuration...\n');

  try {
    // Test 1: Check if Grafana is accessible
    console.log('Test 1: Checking Grafana accessibility...');
    const grafanaResponse = await fetch(GRAFANA_URL);
    console.log(`Grafana status: ${grafanaResponse.status} ${grafanaResponse.statusText}`);
    
    // Test 2: Check CORS headers
    console.log('\nTest 2: Checking CORS headers...');
    const corsResponse = await fetch(`${GRAFANA_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Origin': NEXT_APP_URL
      }
    });
    
    const allowOrigin = corsResponse.headers.get('access-control-allow-origin');
    console.log(`Access-Control-Allow-Origin: ${allowOrigin}`);
    
    if (allowOrigin === '*' || allowOrigin === NEXT_APP_URL) {
      console.log('✅ CORS is properly configured for embedding');
    } else {
      console.log('❌ CORS may not be properly configured for embedding');
    }
    
    // Test 3: Check if we can access the dashboard panels
    console.log('\nTest 3: Checking dashboard panel access...');
    // This would typically require authentication, so we'll just check if the endpoint exists
    const panelResponse = await fetch(`${GRAFANA_URL}/api/search?query=devart.ai`);
    console.log(`Dashboard search status: ${panelResponse.status} ${panelResponse.statusText}`);
    
    if (panelResponse.ok) {
      const dashboards = await panelResponse.json();
      console.log(`Found ${dashboards.length} dashboards matching 'devart.ai'`);
      if (dashboards.length > 0) {
        console.log('✅ Dashboard access is working');
      } else {
        console.log('⚠️ No dashboards found matching the query');
      }
    } else {
      console.log('❌ Failed to access dashboards');
    }
    
    // Test 4: Check embedding settings
    console.log('\nTest 4: Checking embedding settings...');
    // We can't directly check Grafana settings via API without admin access,
    // but we can try to load an iframe and see if it works
    
    console.log('To fully test embedding:');
    console.log('1. Start your Next.js application');
    console.log('2. Navigate to the dashboard page');
    console.log('3. Switch to the "Dashboards" tab');
    console.log('4. Verify that all embedded panels load correctly');
    console.log('5. Check the browser console for any CORS errors');
    
  } catch (error) {
    console.error('Error during testing:', error.message);
  }
}

// Run the test
testGrafanaEmbedding();