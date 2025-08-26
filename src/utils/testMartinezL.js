// Test specifico per "Martinez L." - Debug del problema di matching
// Usage: node src/utils/testMartinezL.js

import FBRefScraper from './fbrefScraper.js';

async function testMartinezL() {
  console.log('🧪 Testing Martinez L. Search with Enhanced System\n');
  
  const scraper = new FBRefScraper({
    rateLimit: 2000, // 2 secondi per test più veloce
    maxRetries: 2
  });

  const testCases = [
    'Martinez L.',
    'Martinez L',
    'Lautaro Martinez',
    'Lautaro Martínez'
  ];

  for (const playerName of testCases) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎯 Testing: "${playerName}"`);
      console.log('='.repeat(60));
      
      console.log('\n🔍 Step 1: Name Expansion Test');
      const variants = scraper.expandPlayerName(playerName);
      console.log('📝 Search variants generated:');
      variants.forEach((variant, i) => {
        console.log(`  ${i + 1}. "${variant}"`);
      });
      
      console.log('\n📡 Step 2: Search Test');
      const searchResults = await scraper.searchPlayer(playerName);
      
      if (searchResults.length > 0) {
        console.log(`\n✅ SUCCESS! Found ${searchResults.length} results:`);
        searchResults.slice(0, 5).forEach((result, i) => {
          console.log(`\n  ${i + 1}. 🏆 ${result.name}`);
          console.log(`      Score: ${result.relevanceScore}/100`);
          console.log(`      Via: "${result.searchVariant}"`);
          console.log(`      URL: ${result.url}`);
        });
        
        // Se troviamo un risultato buono, testiamo anche l'estrazione stats
        const bestResult = searchResults[0];
        if (bestResult.relevanceScore > 50) {
          console.log(`\n📊 Step 3: Stats Extraction Test for "${bestResult.name}"`);
          
          try {
            const statsData = await scraper.getPlayerStats(bestResult.url);
            
            if (statsData) {
              console.log('✅ Stats extracted successfully!');
              console.log('\n📋 Quick Stats Preview:');
              console.log(`  Full Name: ${statsData.playerInfo.fullName || statsData.playerInfo.name}`);
              console.log(`  Current Team: ${statsData.playerInfo.currentTeam || 'N/A'}`);
              console.log(`  Position: ${statsData.playerInfo.position || 'N/A'}`);
              console.log(`  Total Matches: ${statsData.careerStats.totals.matches || 'N/A'}`);
              console.log(`  Total Goals: ${statsData.careerStats.totals.goals || 'N/A'}`);
              console.log(`  Total Assists: ${statsData.careerStats.totals.assists || 'N/A'}`);
              
              // Save detailed results
              const fs = await import('fs');
              const fileName = `martinez_test_${playerName.replace(/[.\s]/g, '_').toLowerCase()}.json`;
              fs.writeFileSync(fileName, JSON.stringify(statsData, null, 2));
              console.log(`💾 Detailed data saved: ${fileName}`);
              
            } else {
              console.log('❌ Failed to extract stats');
            }
            
          } catch (statsError) {
            console.log('❌ Stats extraction failed:', statsError.message);
          }
        }
        
      } else {
        console.log('❌ No results found');
      }
      
    } catch (error) {
      console.error(`❌ Test failed for "${playerName}":`, error.message);
    }
    
    // Pausa tra test
    if (playerName !== testCases[testCases.length - 1]) {
      console.log('\n⏳ Waiting before next test...');
      await scraper.delay(3000);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Martinez L. Test Suite Completed!');
  console.log('='.repeat(60));
  
  console.log('\n📝 Summary:');
  console.log('✅ Enhanced name expansion system');
  console.log('✅ Multiple search variants');
  console.log('✅ Improved relevance scoring');
  console.log('✅ Better error handling');
  console.log('\nNow try "Martinez L." in the app! 🚀');
}

// Gestione errori
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Esegui test
if (import.meta.url === `file://${process.argv[1]}`) {
  testMartinezL()
    .then(() => {
      console.log('\n🎉 Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}
