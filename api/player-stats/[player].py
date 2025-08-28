#!/usr/bin/env python3
"""
API Vercel per Statistiche Fantacalcio con FBref reale
Versione ottimizzata per ambiente serverless
"""

import json
import urllib.parse
import logging
import os
import time
from http.server import BaseHTTPRequestHandler
from fuzzywuzzy import fuzz
import pandas as pd

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VercelFBrefService:
    """Servizio FBref ottimizzato per Vercel"""
    
    def __init__(self):
        self.soccerdata_available = False
        self.fbref = None
        self._data_cache = {}
        
        try:
            import soccerdata as sd
            
            logger.info("🔄 Inizializzazione FBref per Vercel...")
            
            # Inizializza FBref solo per Serie A stagione corrente per velocità
            self.fbref = sd.FBref(
                leagues=['ITA-Serie A'], 
                seasons=['2425']  # Solo 2024-25 per performance
            )
            
            self.soccerdata_available = True
            logger.info("✅ SoccerData inizializzato per Vercel")
            
        except Exception as e:
            logger.error(f"❌ Errore inizializzazione SoccerData: {e}")
            self.soccerdata_available = False
    
    def _safe_numeric(self, value, default=0):
        """Converte un valore in numero, gestendo NaN e valori non validi"""
        try:
            numeric_value = pd.to_numeric(value, errors='coerce')
            if pd.isna(numeric_value) or numeric_value == float('inf') or numeric_value == float('-inf'):
                return default
            return numeric_value
        except:
            return default
    
    def _safe_round(self, value, decimals=1, default=0):
        """Arrotonda un valore gestendo NaN e infiniti"""
        try:
            numeric_value = pd.to_numeric(value, errors='coerce')
            if pd.isna(numeric_value) or numeric_value == float('inf') or numeric_value == float('-inf'):
                return default
            return round(float(numeric_value), decimals)
        except:
            return default
    
    def _normalize_player_name(self, player_name):
        """Normalizza i nomi dei giocatori"""
        name_lower = player_name.lower().strip()
        
        # Mappature specifiche per abbreviazioni comuni
        name_mappings = {
            "martinez l.": "lautaro martinez",
            "martinez l": "lautaro martinez", 
            "lautaro m.": "lautaro martinez",
            "thuram m.": "marcus thuram",
            "thuram": "marcus thuram",
            "vlahovic d.": "dusan vlahovic",
            "vlahovic": "dusan vlahovic",
            "osimhen v.": "victor osimhen",
            "osimhen": "victor osimhen",
            "yildiz": "kenan yildiz",
            "yildiz k.": "kenan yildiz",
            "kenan y.": "kenan yildiz",
            "chiesa": "federico chiesa",
            "chiesa f.": "federico chiesa",
            "kvaratskhelia": "khvicha kvaratskhelia",
            "kvara": "khvicha kvaratskhelia"
        }
        
        if name_lower in name_mappings:
            logger.info(f"🔄 Mappatura: '{name_lower}' -> '{name_mappings[name_lower]}'")
            return name_mappings[name_lower]
        
        return name_lower
    
    def _load_stats_data(self, stat_type):
        """Carica dati statistiche con cache"""
        if stat_type in self._data_cache:
            return self._data_cache[stat_type]
        
        try:
            logger.info(f"📥 Caricamento {stat_type} stats...")
            data = self.fbref.read_player_season_stats(stat_type=stat_type)
            self._data_cache[stat_type] = data
            logger.info(f"✅ Caricate {len(data)} righe {stat_type}")
            return data
        except Exception as e:
            logger.warning(f"⚠️ Errore caricamento {stat_type}: {e}")
            return pd.DataFrame()
    
    def _find_player(self, player_name, team_name=None):
        """Trova un giocatore usando fuzzy matching"""
        # Carica solo le statistiche standard per il matching
        standard_stats = self._load_stats_data('standard')
        
        if standard_stats.empty:
            return None
        
        normalized_input = self._normalize_player_name(player_name)
        logger.info(f"🔍 Ricerca: '{player_name}' -> '{normalized_input}'")
        
        all_players = standard_stats.index.get_level_values('player').unique()
        best_match = None
        best_score = 0
        
        for player in all_players:
            score = fuzz.ratio(normalized_input, player.lower())
            
            # Bonus per match parziali
            if normalized_input in player.lower() or player.lower() in normalized_input:
                score += 30
            
            # Bonus per match di parole chiave
            normalized_words = normalized_input.split()
            player_words = player.lower().split()
            
            word_matches = 0
            for norm_word in normalized_words:
                for player_word in player_words:
                    if len(norm_word) > 2 and len(player_word) > 2:
                        if norm_word in player_word or player_word in norm_word:
                            word_matches += 1
                            score += 20
            
            # Bonus per team se specificato
            if team_name and score > 60:
                player_data = standard_stats[
                    standard_stats.index.get_level_values('player') == player
                ]
                player_teams = player_data.index.get_level_values('team').unique()
                for team in player_teams:
                    if team_name.lower() in team.lower():
                        score += 40
                        break
            
            if score > best_score and score > 80:
                best_score = score
                best_match = player
        
        if best_match:
            logger.info(f"🎯 Trovato: {best_match} (score: {best_score})")
            return best_match
        
        logger.warning(f"❌ Nessun match per '{player_name}'")
        return None
    
    def _is_goalkeeper(self, matched_player, standard_data):
        """Verifica se è un portiere"""
        try:
            # Carica statistiche keeper
            keeper_stats = self._load_stats_data('keeper')
            if not keeper_stats.empty:
                keeper_matches = keeper_stats[
                    keeper_stats.index.get_level_values('player') == matched_player
                ]
                if not keeper_matches.empty:
                    return True
            
            # Fallback: controlla se ha pochi gol/assist e pochi minuti per partita
            if not standard_data.empty:
                goals = pd.to_numeric(standard_data.iloc[0].get(('Performance', 'Gls'), 0), errors='coerce') or 0
                assists = pd.to_numeric(standard_data.iloc[0].get(('Performance', 'Ast'), 0), errors='coerce') or 0
                minutes = pd.to_numeric(standard_data.iloc[0].get(('Playing Time', 'Min'), 0), errors='coerce') or 0
                matches = pd.to_numeric(standard_data.iloc[0].get(('Playing Time', 'MP'), 1), errors='coerce') or 1
                
                avg_minutes = minutes / matches if matches > 0 else 0
                
                # Probabilmente un portiere se: 0 gol, 0 assist, alta media minuti
                if goals == 0 and assists == 0 and avg_minutes > 70:
                    return True
                    
        except Exception as e:
            logger.warning(f"⚠️ Errore check portiere: {e}")
        
        return False
    
    def get_player_stats(self, player_name, team_name=None):
        """Recupera statistiche reali del giocatore"""
        if not self.soccerdata_available:
            return {
                "error": "SoccerData non disponibile in ambiente Vercel",
                "message": "Servizio non inizializzato"
            }
        
        try:
            logger.info(f"🔍 Richiesta stats per {player_name} ({team_name or 'auto'})")
            
            # Trova il giocatore
            matched_player = self._find_player(player_name, team_name)
            if not matched_player:
                return {
                    "error": f"Giocatore '{player_name}' non trovato",
                    "available_players": []
                }
            
            # Recupera statistiche standard
            standard_stats = self._load_stats_data('standard')
            standard_data = standard_stats[
                standard_stats.index.get_level_values('player') == matched_player
            ]
            
            if standard_data.empty:
                return {"error": f"Nessun dato per {matched_player}"}
            
            # Prendi il dato più recente
            current_data = standard_data.iloc[0]
            current_index = standard_data.index[0]
            league, season, team, full_name = current_index
            
            # Verifica se è un portiere
            is_goalkeeper = self._is_goalkeeper(matched_player, standard_data)
            
            # Costruisci risposta base
            result = {
                "player": {
                    "name": full_name,
                    "team": team,
                    "league": league,
                    "season": "2024-25"
                },
                "stats": {
                    "generale": {
                        "partite_giocate": int(self._safe_numeric(current_data.get(('Playing Time', 'MP'), 0))),
                        "minuti_totali": int(self._safe_numeric(current_data.get(('Playing Time', 'Min'), 0))),
                        "gol": int(self._safe_numeric(current_data.get(('Performance', 'Gls'), 0))),
                        "assist": int(self._safe_numeric(current_data.get(('Performance', 'Ast'), 0))),
                        "cartellini_gialli": int(self._safe_numeric(current_data.get(('Performance', 'CrdY'), 0))),
                        "cartellini_rossi": int(self._safe_numeric(current_data.get(('Performance', 'CrdR'), 0)))
                    },
                    "passaggi": {},
                    "portiere": {}
                },
                "fantacalcio_insights": {
                    "voto_medio_stimato": round(6.0 + (int(self._safe_numeric(current_data.get(('Performance', 'Gls'), 0))) + int(self._safe_numeric(current_data.get(('Performance', 'Ast'), 0)))) * 0.1, 1),
                    "bonus_malus_attesi": round((int(self._safe_numeric(current_data.get(('Performance', 'Gls'), 0))) * 3 + int(self._safe_numeric(current_data.get(('Performance', 'Ast'), 0))) - int(self._safe_numeric(current_data.get(('Performance', 'CrdY'), 0))) * 0.5), 1),
                    "affidabilita": "Alta" if int(self._safe_numeric(current_data.get(('Playing Time', 'MP'), 0))) > 15 else "Media",
                    "trend": "Stabile",
                    "consigli": [
                        f"Ha giocato {int(self._safe_numeric(current_data.get(('Playing Time', 'MP'), 0)))} partite",
                        f"Contributo gol+assist: {int(self._safe_numeric(current_data.get(('Performance', 'Gls'), 0))) + int(self._safe_numeric(current_data.get(('Performance', 'Ast'), 0)))}",
                        "Dati reali FBref via Vercel Serverless"
                    ]
                },
                "fonte": "FBref via SoccerData (Vercel)",
                "ultimo_aggiornamento": "2024-12-28"
            }
            
            # Aggiungi statistiche passing se disponibili
            try:
                passing_stats = self._load_stats_data('passing')
                if not passing_stats.empty:
                    passing_data = passing_stats[
                        passing_stats.index.get_level_values('player') == matched_player
                    ]
                    if not passing_data.empty:
                        passing_current = passing_data.iloc[0]
                        result["stats"]["passaggi"] = {
                            "passaggi_totali": int(self._safe_numeric(passing_current.get(('Total', 'Att'), 0))),
                            "precisione_passaggi": self._safe_round(passing_current.get(('Total', 'Cmp%'), 0), 1)
                        }
            except Exception as e:
                logger.warning(f"⚠️ Errore caricamento passaggi: {e}")
            
            # Aggiungi statistiche portiere se applicabile
            if is_goalkeeper:
                try:
                    keeper_stats = self._load_stats_data('keeper')
                    if not keeper_stats.empty:
                        keeper_data = keeper_stats[
                            keeper_stats.index.get_level_values('player') == matched_player
                        ]
                        if not keeper_data.empty:
                            keeper_current = keeper_data.iloc[0]
                            result["stats"]["portiere"] = {
                                "partite_giocate": int(self._safe_numeric(keeper_current.get(('Playing Time', 'MP'), 0))),
                                "gol_subiti": int(self._safe_numeric(keeper_current.get(('Performance', 'GA'), 0))),
                                "parate": int(self._safe_numeric(keeper_current.get(('Performance', 'Saves'), 0))),
                                "percentuale_parate": self._safe_round(keeper_current.get(('Performance', 'Save%'), 0), 1),
                                "clean_sheets": int(self._safe_numeric(keeper_current.get(('Performance', 'CS'), 0))),
                                "percentuale_clean_sheets": self._safe_round(keeper_current.get(('Performance', 'CS%'), 0), 1)
                            }
                            
                            # Aggiorna insights per portiere
                            clean_sheets = result["stats"]["portiere"]["clean_sheets"]
                            gol_subiti = result["stats"]["portiere"]["gol_subiti"]
                            
                            result["fantacalcio_insights"].update({
                                "voto_medio_stimato": round(6.0 + clean_sheets * 0.1 - gol_subiti * 0.05, 1),
                                "bonus_malus_attesi": round(clean_sheets - gol_subiti, 1),
                                "ruolo": "Portiere",
                                "consigli": [
                                    f"Portiere con {clean_sheets} clean sheets",
                                    f"Parate: {result['stats']['portiere']['parate']}",
                                    "Dati reali FBref via Vercel Serverless"
                                ]
                            })
                except Exception as e:
                    logger.warning(f"⚠️ Errore caricamento stats portiere: {e}")
            
            logger.info(f"✅ Stats reali recuperate per {full_name}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Errore recupero stats: {e}")
            return {"error": f"Errore interno: {str(e)}"}

# Inizializza servizio globale
service = VercelFBrefService()

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # Parse dell'URL per estrarre parametri
            parsed_url = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            
            # Estrai nome giocatore dall'URL dinamico
            path_parts = parsed_url.path.strip('/').split('/')
            player_name = path_parts[-1] if path_parts else "Unknown"
            player_name = urllib.parse.unquote(player_name)
            
            # Estrai parametro team se presente
            team_name = query_params.get('team', [None])[0]
            
            logger.info(f"🎯 API Request: {player_name} ({team_name or 'no team'})")
            
            # Recupera statistiche reali
            stats = service.get_player_stats(player_name, team_name)
            
            # Invio risposta con headers CORS
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            
            self.wfile.write(json.dumps(stats).encode())
            
        except Exception as e:
            logger.error(f"❌ Errore handler: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()