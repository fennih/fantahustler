// FBRef Explorer - Analisi struttura sito
// Utilizzo: node src/utils/fbrefExplorer.js

const cheerio = require('cheerio');

class FBRefExplorer {
  constructor() {
    this.baseUrl = 'https://fbref.com';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async searchPlayer(playerName) {
    try {
      console.log(`🔍 Searching for: ${playerName}`);
      
      // FBRef ha una funzione di ricerca
      const searchUrl = `${this.baseUrl}/search/search.fcgi?search=${encodeURIComponent(playerName)}`;
      
      console.log(`📡 Fetching: ${searchUrl}`);
      
      const response = await fetch(searchUrl, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Analizza i risultati della ricerca
      console.log('📊 Search results found:');
      
      // FBRef di solito mostra i risultati in una tabella
      const searchResults = [];
      
      // Pattern comuni per i link dei giocatori su FBRef
      $('a[href*="/en/players/"]').each((i, element) => {
        const link = $(element);
        const href = link.attr('href');
        const name = link.text().trim();
        
        if (name && href && name.toLowerCase().includes(playerName.toLowerCase())) {
          searchResults.push({
            name: name,
            url: this.baseUrl + href,
            type: 'player'
          });
        }
      });

      return searchResults;

    } catch (error) {
      console.error('❌ Error searching player:', error.message);
      return [];
    }
  }

  async getPlayerStats(playerUrl) {
    try {
      console.log(`📊 Getting stats from: ${playerUrl}`);
      
      // Rispettiamo rate limiting
      await this.delay(2000);
      
      const response = await fetch(playerUrl, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Struttura tipica di una pagina giocatore FBRef
      const playerInfo = {
        name: $('h1').text().trim(),
        position: $('p:contains("Position")').text(),
        team: $('p:contains("Club")').text(),
        nationality: $('span.f-i').parent().text(),
        age: $('span#necro-birth').text(),
      };

      // Statistiche di carriera - di solito in tabelle con ID specifici
      const careerStats = {
        seasons: [],
        totals: {}
      };

      // Le tabelle FBRef hanno ID specifici come "stats_standard" per le statistiche base
      $('#stats_standard tbody tr').each((i, row) => {
        const $row = $(row);
        const season = $row.find('th').text().trim();
        
        if (season && !season.includes('Season')) {
          const stats = {
            season: season,
            team: $row.find('td').eq(0).text().trim(),
            league: $row.find('td').eq(1).text().trim(),
            matches: parseInt($row.find('td').eq(2).text()) || 0,
            starts: parseInt($row.find('td').eq(3).text()) || 0,
            minutes: parseInt($row.find('td').eq(4).text()) || 0,
            goals: parseInt($row.find('td').eq(5).text()) || 0,
            assists: parseInt($row.find('td').eq(6).text()) || 0,
            // Aggiungi altre statistiche in base alla struttura della tabella
          };
          
          careerStats.seasons.push(stats);
        }
      });

      return {
        playerInfo,
        careerStats
      };

    } catch (error) {
      console.error('❌ Error getting player stats:', error.message);
      return null;
    }
  }

  async explorePlayer(playerName) {
    console.log(`🚀 Starting exploration for: ${playerName}`);
    
    // Step 1: Cerca il giocatore
    const searchResults = await this.searchPlayer(playerName);
    
    if (searchResults.length === 0) {
      console.log('❌ No results found');
      return null;
    }

    console.log(`✅ Found ${searchResults.length} results:`);
    searchResults.forEach((result, i) => {
      console.log(`${i + 1}. ${result.name} - ${result.url}`);
    });

    // Step 2: Prendi il primo risultato (o chiedi all'utente)
    const firstResult = searchResults[0];
    console.log(`🎯 Analyzing: ${firstResult.name}`);

    // Step 3: Estrai le statistiche
    const playerData = await this.getPlayerStats(firstResult.url);
    
    if (playerData) {
      console.log('✅ Player data extracted successfully!');
      console.log(JSON.stringify(playerData, null, 2));
    }

    return playerData;
  }
}

// Test con Nico Paz se eseguito direttamente
if (require.main === module) {
  const explorer = new FBRefExplorer();
  
  // Testa con il giocatore richiesto
  explorer.explorePlayer('Nico Paz')
    .then(result => {
      if (result) {
        console.log('🎉 Exploration completed successfully!');
      } else {
        console.log('❌ Exploration failed');
      }
    })
    .catch(error => {
      console.error('💥 Fatal error:', error);
    });
}

module.exports = FBRefExplorer;
