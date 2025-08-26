// FBRef Scraper - Sistema di scraping statistiche giocatori
// Versione v1.0 - Approach graduali con safety features

import * as cheerio from 'cheerio';

// ⚠️ IMPORTANTE: Rate limiting per rispettare i server
const RATE_LIMIT_MS = 3000; // 3 secondi tra le richieste
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 10000; // 10 secondi timeout

class FBRefScraper {
  constructor(options = {}) {
    this.baseUrl = 'https://fbref.com';
    this.rateLimit = options.rateLimit || RATE_LIMIT_MS;
    this.maxRetries = options.maxRetries || MAX_RETRIES;
    this.timeout = options.timeout || REQUEST_TIMEOUT;
    this.lastRequestTime = 0;
    this.sessionEstablished = false;
    
    // Headers più realistici per evitare blocchi
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,it;q=0.8,es;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"'
    };

    this.cache = new Map(); // Cache delle richieste
  }

  /**
   * Rispetta il rate limiting
   */
  async respectRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimit) {
      const waitTime = this.rateLimit - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms...`);
      await this.delay(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Helper per delay
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stabilisce una sessione visitando la homepage (anti-bot)
   */
  async establishSession() {
    if (this.sessionEstablished) return;
    
    try {
      console.log('🔗 Establishing session with FBRef...');
      
      const response = await fetch(this.baseUrl, {
        headers: {
          ...this.headers,
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-User': '?1'
        }
      });
      
      if (response.ok) {
        this.sessionEstablished = true;
        console.log('✅ Session established');
        await this.delay(1000); // Pausa dopo l'homepage
      }
    } catch (error) {
      console.warn('⚠️ Failed to establish session:', error.message);
    }
  }

  /**
   * Fetch con retry e error handling migliorato
   */
  async safeFetch(url, retryCount = 0, isSearch = false) {
    try {
      // Stabilisci sessione per le ricerche
      if (isSearch) {
        await this.establishSession();
      }
      
      await this.respectRateLimit();
      
      console.log(`📡 Fetching: ${url} (attempt ${retryCount + 1})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      // Headers dinamici basati sul tipo di richiesta
      const requestHeaders = { ...this.headers };
      
      if (isSearch) {
        requestHeaders['Referer'] = this.baseUrl;
        requestHeaders['Sec-Fetch-Site'] = 'same-origin';
      }
      
      const response = await fetch(url, {
        headers: requestHeaders,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Gestione specifica errore 403
      if (response.status === 403) {
        console.warn('🚫 403 Forbidden - FBRef might be blocking us');
        
        if (retryCount === 0) {
          console.log('🔄 Trying session reset...');
          this.sessionEstablished = false;
          await this.delay(5000); // Pausa più lunga per 403
          return this.safeFetch(url, retryCount + 1, isSearch);
        }
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      return html;
      
    } catch (error) {
      console.error(`❌ Fetch error (attempt ${retryCount + 1}):`, error.message);
      
      if (retryCount < this.maxRetries - 1) {
        const backoffTime = Math.min((retryCount + 1) * 3000, 10000); // Max 10 sec
        console.log(`🔄 Retrying in ${backoffTime}ms...`);
        await this.delay(backoffTime);
        return this.safeFetch(url, retryCount + 1, isSearch);
      }
      
      throw error;
    }
  }

  /**
   * Espande nomi abbreviati con varianti comuni
   */
  expandPlayerName(playerName) {
    // Mappatura nomi comuni (aggiungi qui altri giocatori problematici)
    const nameMapping = {
      'martinez l.': ['Lautaro Martinez', 'Lautaro Martínez', 'L. Martinez', 'Martinez Lautaro'],
      'martinez l': ['Lautaro Martinez', 'Lautaro Martínez'],
      'de vrij': ['Stefan de Vrij', 'De Vrij Stefan'],
      'dumfries': ['Denzel Dumfries'],
      'barella': ['Nicolò Barella', 'Nicolo Barella'],
      'bastoni': ['Alessandro Bastoni'],
      'dimarco': ['Federico Dimarco'],
      'calhanoglu': ['Hakan Calhanoglu', 'Hakan Çalhanoğlu'],
      'thuram': ['Marcus Thuram', 'M. Thuram'],
      // Aggiungi altri mappings qui
    };

    const searchVariants = [];
    const normalizedName = playerName.toLowerCase().trim();
    
    // 1. Nome originale
    searchVariants.push(playerName);
    
    // 2. Check mappatura specifica
    if (nameMapping[normalizedName]) {
      searchVariants.push(...nameMapping[normalizedName]);
    }
    
    // 3. Se termina con iniziale (es. "Martinez L."), prova senza
    if (normalizedName.match(/\w+\s+\w\.$/)) {
      const baseName = normalizedName.replace(/\s+\w\.$/, '');
      searchVariants.push(baseName);
    }
    
    // 4. Se ha un apostrofo o carattere speciale, prova versioni alternative
    if (playerName.includes("'") || playerName.includes('è') || playerName.includes('à')) {
      searchVariants.push(
        playerName.replace(/[èéêë]/g, 'e')
                  .replace(/[àáâä]/g, 'a')
                  .replace(/[ìíîï]/g, 'i')
                  .replace(/[òóôö]/g, 'o')
                  .replace(/[ùúûü]/g, 'u')
                  .replace(/'/g, '')
      );
    }
    
    // Rimuovi duplicati mantenendo l'ordine
    return [...new Set(searchVariants)];
  }

  /**
   * Cerca un giocatore su FBRef con varianti multiple
   */
  async searchPlayer(playerName) {
    try {
      console.log(`🔍 Searching for player: "${playerName}"`);
      
      // Cache check
      const cacheKey = `search_${playerName.toLowerCase()}`;
      if (this.cache.has(cacheKey)) {
        console.log('💾 Using cached search results');
        return this.cache.get(cacheKey);
      }
      
      // Espandi nome in varianti possibili
      const searchVariants = this.expandPlayerName(playerName);
      console.log(`🎯 Trying ${searchVariants.length} search variants:`, searchVariants);
      
      let allResults = [];
      
      // Prova ogni variante
      for (const [index, variant] of searchVariants.entries()) {
        console.log(`📡 Variant ${index + 1}: "${variant}"`);
        
        try {
          const searchUrl = `${this.baseUrl}/search/search.fcgi?search=${encodeURIComponent(variant)}`;
          const html = await this.safeFetch(searchUrl, 0, true); // isSearch = true
          const $ = cheerio.load(html);
          
          const variantResults = [];
          const playerLinks = new Set(); // Evita duplicati per questa variante
          
          // Cerca link a pagine giocatori
          $('a[href*="/en/players/"]').each((i, element) => {
            const $link = $(element);
            const href = $link.attr('href');
            const text = $link.text().trim();
            
            if (text && href && !playerLinks.has(href)) {
              playerLinks.add(href);
              
              variantResults.push({
                name: text,
                url: this.baseUrl + href,
                type: 'player',
                searchVariant: variant,
                relevanceScore: this.calculateRelevance(text, playerName, variant)
              });
            }
          });
          
          console.log(`  → Found ${variantResults.length} results for "${variant}"`);
          allResults.push(...variantResults);
          
          // Se troviamo risultati buoni, possiamo fermarci prima
          if (variantResults.some(r => r.relevanceScore > 80)) {
            console.log('🎯 Found high-relevance results, stopping search');
            break;
          }
          
        } catch (error) {
          console.warn(`⚠️ Failed to search variant "${variant}":`, error.message);
        }
        
        // Rate limiting tra le varianti
        if (index < searchVariants.length - 1) {
          await this.delay(1000); // 1 secondo tra varianti
        }
      }
      
      // Rimuovi duplicati per URL e ordina per rilevanza
      const uniqueResults = [];
      const seenUrls = new Set();
      
      for (const result of allResults) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          uniqueResults.push(result);
        }
      }
      
      // Ordina per rilevanza
      uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      console.log(`✅ Found ${uniqueResults.length} unique player matches total`);
      uniqueResults.slice(0, 5).forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.name} (score: ${result.relevanceScore}, via: "${result.searchVariant}")`);
      });
      
      // Cache dei risultati
      this.cache.set(cacheKey, uniqueResults);
      
      return uniqueResults;
      
    } catch (error) {
      console.error('❌ Search error:', error.message);
      
      // Fallback: se tutte le ricerche falliscono per 403, prova strategia alternativa
      if (error.message.includes('403')) {
        console.log('🔄 Trying alternative search strategy...');
        return this.alternativeSearch(playerName);
      }
      
      return [];
    }
  }

  /**
   * Strategia di ricerca alternativa quando quella principale è bloccata
   */
  async alternativeSearch(playerName) {
    try {
      console.log(`🎲 Alternative search for: "${playerName}"`);
      
      // Strategia 1: Prova a cercare su pagine di squadre (es. Inter per Martinez)
      if (playerName.toLowerCase().includes('martinez') || playerName.toLowerCase().includes('lautaro')) {
        console.log('🔍 Trying Inter squad page...');
        
        const interUrl = `${this.baseUrl}/en/squads/d609eea0/Inter`;
        try {
          const html = await this.safeFetch(interUrl);
          const $ = cheerio.load(html);
          
          const results = [];
          
          // Cerca nella tabella dei giocatori dell'Inter
          $('table.stats_table tbody tr').each((i, row) => {
            const $row = $(row);
            const nameCell = $row.find('td[data-stat="player"] a');
            const name = nameCell.text().trim();
            const href = nameCell.attr('href');
            
            if (name && href && this.nameMatches(name, playerName)) {
              results.push({
                name: name,
                url: this.baseUrl + href,
                type: 'player',
                searchVariant: 'Inter squad page',
                relevanceScore: this.calculateRelevance(name, playerName, 'Inter squad')
              });
            }
          });
          
          if (results.length > 0) {
            console.log(`✅ Found ${results.length} results via Inter squad page`);
            return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
          }
        } catch (error) {
          console.warn('⚠️ Inter squad page failed:', error.message);
        }
      }
      
      console.log('❌ All alternative strategies failed');
      return [];
      
    } catch (error) {
      console.error('❌ Alternative search failed:', error.message);
      return [];
    }
  }

  /**
   * Controlla se un nome trovato matcha con quello cercato
   */
  nameMatches(foundName, searchName) {
    const found = foundName.toLowerCase();
    const search = searchName.toLowerCase();
    
    // Match diretto
    if (found.includes(search) || search.includes(found)) return true;
    
    // Match per parole
    const searchWords = search.split(' ').filter(w => w.length > 2);
    const foundWords = found.split(' ');
    
    let matches = 0;
    for (const searchWord of searchWords) {
      if (foundWords.some(foundWord => 
        foundWord.includes(searchWord) || searchWord.includes(foundWord)
      )) {
        matches++;
      }
    }
    
    return matches >= Math.min(2, searchWords.length);
  }

  /**
   * Calcola rilevanza della ricerca migliorata
   */
  calculateRelevance(foundName, originalSearch, searchVariant = null) {
    const found = foundName.toLowerCase();
    const original = originalSearch.toLowerCase();
    const variant = (searchVariant || originalSearch).toLowerCase();
    
    let score = 0;
    
    // 1. Match esatto con variante di ricerca = 100 punti
    if (found === variant) {
      score = 100;
    }
    // 2. Match esatto con ricerca originale = 95 punti  
    else if (found === original) {
      score = 95;
    }
    // 3. Contiene la variante completa = 85 punti
    else if (found.includes(variant)) {
      score = 85;
    }
    // 4. Contiene la ricerca originale = 80 punti
    else if (found.includes(original)) {
      score = 80;
    }
    else {
      // 5. Matching per parole
      const originalWords = original.split(' ').filter(w => w.length > 1);
      const variantWords = variant.split(' ').filter(w => w.length > 1);
      const foundWords = found.split(' ');
      
      let wordMatches = 0;
      let totalWords = Math.max(originalWords.length, variantWords.length);
      
      // Conta matches con parole originali
      for (const searchWord of originalWords) {
        if (foundWords.some(foundWord => 
          foundWord.includes(searchWord) || searchWord.includes(foundWord)
        )) {
          wordMatches++;
        }
      }
      
      // Conta matches con parole varianti (bonus se diverse dall'originale)
      for (const searchWord of variantWords) {
        if (!originalWords.includes(searchWord)) {
          if (foundWords.some(foundWord => 
            foundWord.includes(searchWord) || searchWord.includes(foundWord)
          )) {
            wordMatches += 0.8; // Bonus per match via variante
          }
        }
      }
      
      score = Math.round((wordMatches / totalWords) * 70);
    }
    
    // Bonus per nomi che sembrano giocatori di calcio (hanno nome e cognome)
    if (found.split(' ').length >= 2) {
      score += 5;
    }
    
    // Penalty per nomi troppo generici
    if (found.length < 4) {
      score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Estrae le statistiche di un giocatore
   */
  async getPlayerStats(playerUrl) {
    try {
      console.log(`📊 Extracting stats from: ${playerUrl}`);
      
      const html = await this.safeFetch(playerUrl);
      const $ = cheerio.load(html);
      
      // Informazioni base del giocatore
      const playerInfo = this.extractPlayerInfo($);
      
      // Statistiche carriera per stagione
      const careerStats = this.extractCareerStats($);
      
      // Statistiche internazionali (se disponibili)
      const internationalStats = this.extractInternationalStats($);
      
      // Statistiche avanzate (se disponibili)
      const advancedStats = this.extractAdvancedStats($);
      
      const playerData = {
        url: playerUrl,
        scrapedAt: new Date().toISOString(),
        playerInfo,
        careerStats,
        internationalStats,
        advancedStats
      };
      
      console.log(`✅ Successfully extracted stats for: ${playerInfo.name}`);
      return playerData;
      
    } catch (error) {
      console.error('❌ Stats extraction error:', error.message);
      return null;
    }
  }

  /**
   * Estrae info base del giocatore
   */
  extractPlayerInfo($) {
    try {
      return {
        name: $('h1[data-label="Player"] span').first().text().trim() || $('h1').first().text().trim(),
        fullName: $('p:contains("Full name")').text().replace('Full name: ', '').trim(),
        position: this.extractTextAfterLabel($, 'Position'),
        currentTeam: this.extractTextAfterLabel($, 'Club'),
        nationality: $('span.f-i').parent().text().trim(),
        birthDate: $('span[data-birth]').attr('data-birth'),
        age: this.extractTextAfterLabel($, 'Born'),
        height: this.extractTextAfterLabel($, 'Height'),
        weight: this.extractTextAfterLabel($, 'Weight'),
        foot: this.extractTextAfterLabel($, 'Footed')
      };
    } catch (error) {
      console.warn('⚠️ Error extracting player info:', error.message);
      return {};
    }
  }

  /**
   * Helper per estrarre testo dopo label
   */
  extractTextAfterLabel($, label) {
    const element = $(`p:contains("${label}")`).first();
    if (element.length) {
      return element.text().replace(new RegExp(`.*${label}:?\\s*`), '').trim();
    }
    return '';
  }

  /**
   * Estrae statistiche carriera
   */
  extractCareerStats($) {
    const seasons = [];
    
    try {
      // Tabella standard stats (goals, assists, etc.)
      $('#stats_standard tbody tr').each((i, row) => {
        const $row = $(row);
        const season = $row.find('th').text().trim();
        
        if (season && !season.includes('Season') && season.match(/\d{4}/)) {
          const seasonData = {
            season: season,
            age: parseInt($row.find('td').eq(0).text()) || 0,
            team: $row.find('td').eq(1).text().trim(),
            country: $row.find('td img.f-i').attr('alt') || '',
            league: $row.find('td').eq(2).text().trim(),
            matches: parseInt($row.find('td').eq(3).text()) || 0,
            starts: parseInt($row.find('td').eq(4).text()) || 0,
            minutes: parseInt($row.find('td').eq(5).text().replace(',', '')) || 0,
            goals: parseInt($row.find('td').eq(6).text()) || 0,
            assists: parseInt($row.find('td').eq(7).text()) || 0,
            yellowCards: parseInt($row.find('td').eq(8).text()) || 0,
            redCards: parseInt($row.find('td').eq(9).text()) || 0
          };
          
          seasons.push(seasonData);
        }
      });
      
      console.log(`📈 Extracted ${seasons.length} seasons of career stats`);
      return { seasons, totals: this.calculateTotals(seasons) };
      
    } catch (error) {
      console.warn('⚠️ Error extracting career stats:', error.message);
      return { seasons: [], totals: {} };
    }
  }

  /**
   * Calcola totali carriera
   */
  calculateTotals(seasons) {
    return seasons.reduce((totals, season) => {
      totals.matches = (totals.matches || 0) + season.matches;
      totals.starts = (totals.starts || 0) + season.starts;
      totals.minutes = (totals.minutes || 0) + season.minutes;
      totals.goals = (totals.goals || 0) + season.goals;
      totals.assists = (totals.assists || 0) + season.assists;
      totals.yellowCards = (totals.yellowCards || 0) + season.yellowCards;
      totals.redCards = (totals.redCards || 0) + season.redCards;
      return totals;
    }, {});
  }

  /**
   * Estrae statistiche internazionali
   */
  extractInternationalStats($) {
    // TODO: Implementa estrazione stats nazionali
    return {};
  }

  /**
   * Estrae statistiche avanzate
   */
  extractAdvancedStats($) {
    // TODO: Implementa estrazione stats avanzate (xG, xA, etc.)
    return {};
  }

  /**
   * API principale: cerca e ottieni statistiche complete
   */
  async getPlayerData(playerName) {
    console.log(`🚀 Starting complete data extraction for: "${playerName}"`);
    
    try {
      // 1. Cerca il giocatore
      const searchResults = await this.searchPlayer(playerName);
      
      if (searchResults.length === 0) {
        throw new Error(`Player "${playerName}" not found`);
      }
      
      // 2. Prendi il risultato più rilevante
      const bestMatch = searchResults[0];
      console.log(`🎯 Best match: ${bestMatch.name} (score: ${bestMatch.relevanceScore})`);
      
      // 3. Estrai le statistiche complete
      const playerData = await this.getPlayerStats(bestMatch.url);
      
      if (!playerData) {
        throw new Error('Failed to extract player statistics');
      }
      
      console.log(`✅ Complete data extraction successful for: ${playerData.playerInfo.name}`);
      return playerData;
      
    } catch (error) {
      console.error(`❌ Complete extraction failed:`, error.message);
      throw error;
    }
  }
}

export default FBRefScraper;
