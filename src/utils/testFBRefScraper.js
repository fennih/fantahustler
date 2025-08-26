// Test script per FBRef Scraper
// Usage: node src/utils/testFBRefScraper.js

import FBRefScraper from './fbrefScraper.js';

async function testScraper() {
  console.log('🧪 Starting FBRef Scraper Test Suite\n');
  
  const scraper = new FBRefScraper({
    rateLimit: 4000, // 4 secondi per essere extra prudenti nei test
    maxRetries: 2
  });

  const testPlayers = [
    'Nico Paz',
    'Haaland',
    'Mbappe'
  ];

  for (const playerName of testPlayers) {
    try {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🎯 Testing with: "${playerName}"`);
      console.log('='.repeat(50));
      
      // Test solo ricerca (più veloce)
      console.log('\n📝 Step 1: Search Test');
      const searchResults = await scraper.searchPlayer(playerName);
      
      if (searchResults.length > 0) {
        console.log(`✅ Search successful! Found ${searchResults.length} results`);
        console.log('Top 3 results:');
        searchResults.slice(0, 3).forEach((result, i) => {
          console.log(`  ${i + 1}. ${result.name} - Score: ${result.relevanceScore}`);
          console.log(`     URL: ${result.url}`);
        });
      } else {
        console.log('❌ No search results found');
        continue; // Skip to next player
      }

      // Test statistiche complete (solo per il primo giocatore per non sovraccaricare)
      if (playerName === testPlayers[0]) {
        console.log('\n📊 Step 2: Full Stats Extraction Test');
        
        const playerData = await scraper.getPlayerStats(searchResults[0].url);
        
        if (playerData) {
          console.log('✅ Stats extraction successful!');
          console.log('\n📋 Player Info:');
          console.log('  Name:', playerData.playerInfo.name);
          console.log('  Position:', playerData.playerInfo.position);
          console.log('  Current Team:', playerData.playerInfo.currentTeam);
          console.log('  Nationality:', playerData.playerInfo.nationality);
          console.log('  Age:', playerData.playerInfo.age);
          
          console.log('\n📈 Career Totals:');
          const totals = playerData.careerStats.totals;
          console.log('  Total Matches:', totals.matches || 'N/A');
          console.log('  Total Goals:', totals.goals || 'N/A');
          console.log('  Total Assists:', totals.assists || 'N/A');
          console.log('  Total Minutes:', totals.minutes || 'N/A');
          
          console.log('\n🗓️ Recent Seasons:');
          const recentSeasons = playerData.careerStats.seasons.slice(-3);
          recentSeasons.forEach(season => {
            console.log(`  ${season.season}: ${season.team} - ${season.matches}M, ${season.goals}G, ${season.assists}A`);
          });
          
          // Salva i risultati per analisi
          const fs = await import('fs');
          const outputPath = `fbref_test_${playerName.replace(' ', '_').toLowerCase()}.json`;
          fs.writeFileSync(outputPath, JSON.stringify(playerData, null, 2));
          console.log(`💾 Full data saved to: ${outputPath}`);
          
        } else {
          console.log('❌ Stats extraction failed');
        }
      } else {
        console.log('⏭️ Skipping full stats extraction to avoid rate limiting');
      }

    } catch (error) {
      console.error(`❌ Test failed for "${playerName}":`, error.message);
    }
    
    // Pausa tra i giocatori
    if (playerName !== testPlayers[testPlayers.length - 1]) {
      console.log('\n⏳ Waiting before next test...');
      await scraper.delay(3000);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Test Suite Completed!');
  console.log('='.repeat(50));
}

// Gestione degli errori globali
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Esegui il test
if (import.meta.url === `file://${process.argv[1]}`) {
  testScraper()
    .then(() => {
      console.log('\n🎉 All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}
