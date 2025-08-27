import React, { useState, useEffect, useMemo } from 'react';
import { Search, Upload, Download, Filter, Users, Target, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import PlayerStatsModal from './components/PlayerStatsModal.jsx';
import TacticalFormation from './components/TacticalFormation.jsx';
import SidebarPreferiti from './components/SidebarPreferiti.jsx';
import SuggerimentiIntelligenti from './components/SuggerimentiIntelligenti.jsx';

// Sistema ruoli MANTRA (completo dal file Excel)
const RUOLI_MANTRA = {
  // Portieri
  'Por': { sigla: 'P', colore: 'bg-yellow-500', linea: 'portiere' },
  
  // Difensori
  'Ds': { sigla: 'DS', colore: 'bg-green-600', linea: 'difesa' },
  'Dc': { sigla: 'DC', colore: 'bg-green-500', linea: 'difesa' },
  'Dd': { sigla: 'DD', colore: 'bg-green-600', linea: 'difesa' },
  'B': { sigla: 'B', colore: 'bg-green-700', linea: 'difesa' },
  
  // Centrocampisti
  'E': { sigla: 'E', colore: 'bg-blue-600', linea: 'centrocampo' },
  'M': { sigla: 'M', colore: 'bg-blue-500', linea: 'centrocampo' },
  'C': { sigla: 'C', colore: 'bg-blue-400', linea: 'centrocampo' },
  
  // Trequartisti
  'W': { sigla: 'W', colore: 'bg-purple-500', linea: 'trequarti' },
  'T': { sigla: 'T', colore: 'bg-purple-600', linea: 'trequarti' },
  
  // Attaccanti
  'A': { sigla: 'A', colore: 'bg-red-500', linea: 'attacco' },
  'Pc': { sigla: 'PC', colore: 'bg-red-600', linea: 'attacco' }
};

// Gerarchia ruoli: dal più difensivo al più offensivo
const GERARCHIA_RUOLI = [
  'Por',  // Portiere (più difensivo)
  'B',    // Braccetto
  'Dc',   // Difensore centrale
  'Ds',   // Difensore sinistro  
  'Dd',   // Difensore destro
  'E',    // Esterno
  'M',    // Mediano
  'C',    // Centrocampista
  'W',    // Trequartista/Ala
  'T',    // Trequartista
  'A',    // Attaccante
  'Pc'    // Prima punta (più offensivo)
];



// Funzione per ottenere il ruolo più difensivo di un giocatore con ruoli multipli
const getRuoloPrincipale = (ruoloStringa) => {
  if (!ruoloStringa) return null;
  
  // Se ha ruoli multipli separati da ;, trova il più difensivo
  const ruoli = ruoloStringa.split(';');
  
  // Trova il ruolo con l'indice più basso nella gerarchia (più difensivo)
  let ruoloPiuDifensivo = null;
  let indicePiuBasso = Infinity;
  
  ruoli.forEach(ruolo => {
    const indice = GERARCHIA_RUOLI.indexOf(ruolo);
    if (indice !== -1 && indice < indicePiuBasso) {
      indicePiuBasso = indice;
      ruoloPiuDifensivo = ruolo;
    }
  });
  
  return ruoloPiuDifensivo || ruoli[0]; // Fallback al primo se non trovato
};

// Funzione per ottenere tutti i ruoli di un giocatore
const getTuttiRuoli = (ruoloStringa) => {
  if (!ruoloStringa) return [];
  return ruoloStringa.split(';');
};

// Mappature ruolo difensivo → ruolo offensivo
const RUOLO_OFFENSIVO_MAP = {
  'M': 'C',  // Mediano → Centrocampista (più offensivo)
  'W': 'T',  // Ala → Trequartista (più offensivo)  
  'A': 'Pc'  // Attaccante → Prima Punta (più offensivo)
};

// Funzione per determinare la fascia di un giocatore (automatica + manuale)
const getFasciaGiocatore = (giocatoreId, fvm, fasceManuali, fasceFVM, ruolo, tuttiGiocatori = []) => {
  // Se c'è un'assegnazione manuale, usala
  if (fasceManuali[giocatoreId]) {
    const fasciaKey = fasceManuali[giocatoreId];
    return { key: fasciaKey, ...fasceFVM[fasciaKey] };
  }
  
  // Assegnazione automatica basata su ranking per ruolo
  if (tuttiGiocatori.length === 0) {
    // Fallback se non abbiamo tutti i giocatori
    return { key: 'buoni', ...fasceFVM.buoni };
  }
  
  const ruoloPrincipale = getRuoloPrincipale(ruolo);
  if (!ruoloPrincipale) {
    return { key: 'daEvitare', ...fasceFVM.daEvitare };
  }
  
  // Filtra giocatori dello stesso ruolo e ordinali per FVM decrescente
  const giocatoriStessoRuolo = tuttiGiocatori
    .filter(g => getRuoloPrincipale(g.ruolo) === ruoloPrincipale && g.fvm > 0)
    .sort((a, b) => (b.fvm || 0) - (a.fvm || 0));
  
  // Trova la posizione del giocatore corrente nel ranking
  const posizione = giocatoriStessoRuolo.findIndex(g => g.id === giocatoreId);
  
  if (posizione === -1) {
    return { key: 'daEvitare', ...fasceFVM.daEvitare };
  }
  
  // Assegna fascia in base al ranking:
  // Primi 4: Top
  // Successivi 4: Supertop  
  // Successivi 8: Buoni
  // Successivi 8: Scommesse
  // Resto: Da evitare
  if (posizione < 4) return { key: 'top', ...fasceFVM.top };
  if (posizione < 8) return { key: 'supertop', ...fasceFVM.supertop };
  if (posizione < 16) return { key: 'buoni', ...fasceFVM.buoni };
  if (posizione < 24) return { key: 'scommesse', ...fasceFVM.scommesse };
  return { key: 'daEvitare', ...fasceFVM.daEvitare };
};

// Formula: (slot × 2) + 1 per ogni ruolo + posizioni più offensive
const FORMULA_ROSA = "Formula: (slot × 2) + 1 per ruolo | Preferenza per posizioni offensive (C>M, Pc>A)";

// Moduli target selezionabili dall'utente - TUTTI i moduli MANTRA
const MODULI_TARGET_DEFAULT = [
  '3-4-3', '3-4-1-2', '3-4-2-1', '3-5-2', '3-5-1-1',
  '4-3-3', '4-3-1-2', '4-4-2', '4-1-4-1', '4-4-1-1', '4-2-3-1'
];

// Configurazione moduli CORRETTA con ruoli intercambiabili basata sui diagrammi MANTRA 2025/2026
const CONFIGURAZIONE_MODULI = {
  '3-4-3': {
    // P, DC-DC-DC/B, E-M/C-C-E, W/A-W/A-A/PC
    ruoli: { Por: 1, Dc: 3, B: 1, E: 2, M: 1, C: 2, W: 2, A: 2, Pc: 1 },
    posizioni: [
      { id: 'P1', ruoli: ['Por'], x: 50, y: 8 },
      { id: 'DC1', ruoli: ['Dc'], x: 30, y: 25 }, { id: 'DC2', ruoli: ['Dc'], x: 50, y: 25 }, { id: 'DCB1', ruoli: ['Dc', 'B'], x: 70, y: 25 },
      { id: 'E1', ruoli: ['E'], x: 15, y: 45 }, { id: 'MC1', ruoli: ['M', 'C'], x: 35, y: 50 }, { id: 'C1', ruoli: ['C'], x: 65, y: 50 }, { id: 'E2', ruoli: ['E'], x: 85, y: 45 },
      { id: 'WA1', ruoli: ['W', 'A'], x: 25, y: 75 }, { id: 'WA2', ruoli: ['W', 'A'], x: 75, y: 75 }, { id: 'APC1', ruoli: ['A', 'Pc'], x: 50, y: 85 }
    ],
    linee: { portiere: 1, difesa: 3, centrocampo: 4, trequarti: 0, attacco: 3 }
  },
  '3-4-1-2': {
    // P, DC-DC-DC/B, E-M/C-C-E, T, A/PC-A/PC
    ruoli: { Por: 1, Dc: 3, B: 1, E: 2, M: 1, C: 2, T: 1, A: 1, Pc: 1 },
    posizioni: [
      { id: 'P1', ruoli: ['Por'], x: 50, y: 8 },
      { id: 'DC1', ruoli: ['Dc'], x: 30, y: 25 }, { id: 'DC2', ruoli: ['Dc'], x: 50, y: 25 }, { id: 'DCB1', ruoli: ['Dc', 'B'], x: 70, y: 25 },
      { id: 'E1', ruoli: ['E'], x: 15, y: 45 }, { id: 'MC1', ruoli: ['M', 'C'], x: 35, y: 50 }, { id: 'C1', ruoli: ['C'], x: 65, y: 50 }, { id: 'E2', ruoli: ['E'], x: 85, y: 45 },
      { id: 'T1', ruoli: ['T'], x: 50, y: 65 },
      { id: 'APC1', ruoli: ['A', 'Pc'], x: 35, y: 85 }, { id: 'APC2', ruoli: ['A', 'Pc'], x: 65, y: 85 }
    ],
    linee: { portiere: 1, difesa: 3, centrocampo: 4, trequarti: 1, attacco: 2 }
  },
  '3-4-2-1': {
    // P, DC-DC-DC/B, M-M/C-E-E/W, T-T/A, A/PC
    ruoli: { Por: 1, Dc: 3, B: 1, M: 2, E: 2, C: 1, W: 1, T: 2, A: 1, Pc: 1 },
    posizioni: [
      { id: 'P1', ruoli: ['Por'], x: 50, y: 8 },
      { id: 'DC1', ruoli: ['Dc'], x: 30, y: 25 }, { id: 'DC2', ruoli: ['Dc'], x: 50, y: 25 }, { id: 'DCB1', ruoli: ['Dc', 'B'], x: 70, y: 25 },
      { id: 'E1', ruoli: ['E'], x: 15, y: 45 }, { id: 'MC1', ruoli: ['M', 'C'], x: 35, y: 50 }, { id: 'M1', ruoli: ['M'], x: 65, y: 50 }, { id: 'EW1', ruoli: ['E', 'W'], x: 85, y: 45 },
      { id: 'T1', ruoli: ['T'], x: 35, y: 65 }, { id: 'TA1', ruoli: ['T', 'A'], x: 65, y: 65 },
      { id: 'APC1', ruoli: ['A', 'Pc'], x: 50, y: 85 }
    ],
    linee: { portiere: 1, difesa: 3, centrocampo: 4, trequarti: 2, attacco: 1 }
  },
  '3-5-2': {
    // P, DC-DC-DC/B, M-M/C-C-E/W, A/PC-A/PC
    ruoli: { Por: 1, Dc: 3, B: 1, M: 2, C: 2, E: 1, W: 1, A: 1, Pc: 1 },
    posizioni: [
      { id: 'P1', ruoli: ['Por'], x: 50, y: 8 },
      { id: 'DC1', ruoli: ['Dc'], x: 30, y: 25 }, { id: 'DC2', ruoli: ['Dc'], x: 50, y: 25 }, { id: 'DCB1', ruoli: ['Dc', 'B'], x: 70, y: 25 },
      { id: 'M1', ruoli: ['M'], x: 20, y: 45 }, { id: 'MC1', ruoli: ['M', 'C'], x: 35, y: 50 }, { id: 'C1', ruoli: ['C'], x: 65, y: 50 }, { id: 'EW1', ruoli: ['E', 'W'], x: 80, y: 45 },
      { id: 'APC1', ruoli: ['A', 'Pc'], x: 35, y: 75 }, { id: 'APC2', ruoli: ['A', 'Pc'], x: 65, y: 75 }
    ],
    linee: { portiere: 1, difesa: 3, centrocampo: 4, trequarti: 0, attacco: 2 }
  },
  '3-5-1-1': {
    // P, DC-DC-DC/B, M-M-C-E/W-E/W, T/A, A/PC
    ruoli: { Por: 1, Dc: 3, B: 1, M: 2, C: 1, E: 2, W: 2, T: 1, A: 2, Pc: 1 },
    posizioni: [
      { id: 'P1', ruoli: ['Por'], x: 50, y: 8 },
      { id: 'DC1', ruoli: ['Dc'], x: 30, y: 25 }, { id: 'DC2', ruoli: ['Dc'], x: 50, y: 25 }, { id: 'DCB1', ruoli: ['Dc', 'B'], x: 70, y: 25 },
      { id: 'M1', ruoli: ['M'], x: 25, y: 45 }, { id: 'M2', ruoli: ['M'], x: 50, y: 50 }, { id: 'C1', ruoli: ['C'], x: 75, y: 50 }, { id: 'EW1', ruoli: ['E', 'W'], x: 15, y: 55 }, { id: 'EW2', ruoli: ['E', 'W'], x: 85, y: 55 },
      { id: 'TA1', ruoli: ['T', 'A'], x: 35, y: 75 },
      { id: 'APC1', ruoli: ['A', 'Pc'], x: 65, y: 85 }
    ],
    linee: { portiere: 1, difesa: 3, centrocampo: 5, trequarti: 1, attacco: 1 }
  },
  '4-3-3': {
    // P, DD-DC-DC-DS, W/C-M-C, W/A-W/A-A/PC
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 1, C: 2, W: 2, A: 2, Pc: 1 },
    posizioni: [
      { id: 'P1', ruoli: ['Por'], x: 50, y: 8 },
      { id: 'DD1', ruoli: ['Dd'], x: 80, y: 25 }, { id: 'DC1', ruoli: ['Dc'], x: 60, y: 25 }, { id: 'DC2', ruoli: ['Dc'], x: 40, y: 25 }, { id: 'DS1', ruoli: ['Ds'], x: 20, y: 25 },
      { id: 'WC1', ruoli: ['W', 'C'], x: 25, y: 50 }, { id: 'M1', ruoli: ['M'], x: 50, y: 55 }, { id: 'C1', ruoli: ['C'], x: 75, y: 50 },
      { id: 'WA1', ruoli: ['W', 'A'], x: 25, y: 75 }, { id: 'WA2', ruoli: ['W', 'A'], x: 75, y: 75 }, { id: 'APC1', ruoli: ['A', 'Pc'], x: 50, y: 85 }
    ],
    linee: { portiere: 1, difesa: 4, centrocampo: 3, trequarti: 0, attacco: 3 }
  },
  '4-3-1-2': {
    // P, DD-DC-DC-DS, M/C-M-C, T, T/A/PC-A/PC
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 2, C: 2, T: 2, A: 1, Pc: 2 },
    posizioni: [
      { id: 'P1', ruoli: ['Por'], x: 50, y: 8 },
      { id: 'DD1', ruoli: ['Dd'], x: 80, y: 25 }, { id: 'DC1', ruoli: ['Dc'], x: 60, y: 25 }, { id: 'DC2', ruoli: ['Dc'], x: 40, y: 25 }, { id: 'DS1', ruoli: ['Ds'], x: 20, y: 25 },
      { id: 'MC1', ruoli: ['M', 'C'], x: 25, y: 50 }, { id: 'M1', ruoli: ['M'], x: 50, y: 55 }, { id: 'C1', ruoli: ['C'], x: 75, y: 50 },
      { id: 'T1', ruoli: ['T'], x: 50, y: 65 },
      { id: 'TAPC1', ruoli: ['T', 'A', 'Pc'], x: 35, y: 85 }, { id: 'APC1', ruoli: ['A', 'Pc'], x: 65, y: 85 }
    ],
    linee: { portiere: 1, difesa: 4, centrocampo: 3, trequarti: 1, attacco: 2 }
  },
  '4-4-2': {
    // P, DD-DC-DC-DS, M/C-E-C-E/W, A/PC-A/PC
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 1, C: 2, E: 2, W: 1, A: 1, Pc: 1 },
    posizioni: [
      { id: 'P1', ruoli: ['Por'], x: 50, y: 8 },
      { id: 'DD1', ruoli: ['Dd'], x: 80, y: 25 }, { id: 'DC1', ruoli: ['Dc'], x: 60, y: 25 }, { id: 'DC2', ruoli: ['Dc'], x: 40, y: 25 }, { id: 'DS1', ruoli: ['Ds'], x: 20, y: 25 },
      { id: 'MC1', ruoli: ['M', 'C'], x: 25, y: 50 }, { id: 'E1', ruoli: ['E'], x: 45, y: 55 }, { id: 'C1', ruoli: ['C'], x: 65, y: 55 }, { id: 'EW1', ruoli: ['E', 'W'], x: 85, y: 50 },
      { id: 'APC1', ruoli: ['A', 'Pc'], x: 40, y: 85 }, { id: 'APC2', ruoli: ['A', 'Pc'], x: 60, y: 85 }
    ],
    linee: { portiere: 1, difesa: 4, centrocampo: 4, trequarti: 0, attacco: 2 }
  },
  '4-1-4-1': {
    // P, DD-DC-DC-DS, M, C/T-T-E/W-W, A/PC
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 1, C: 1, T: 3, E: 1, W: 2, A: 1, Pc: 1 },
    posizioni: [
      { id: 'P1', ruoli: ['Por'], x: 50, y: 8 },
      { id: 'DD1', ruoli: ['Dd'], x: 80, y: 25 }, { id: 'DC1', ruoli: ['Dc'], x: 60, y: 25 }, { id: 'DC2', ruoli: ['Dc'], x: 40, y: 25 }, { id: 'DS1', ruoli: ['Ds'], x: 20, y: 25 },
      { id: 'M1', ruoli: ['M'], x: 50, y: 45 },
      { id: 'CT1', ruoli: ['C', 'T'], x: 20, y: 65 }, { id: 'T1', ruoli: ['T'], x: 40, y: 70 }, { id: 'EW1', ruoli: ['E', 'W'], x: 60, y: 70 }, { id: 'W1', ruoli: ['W'], x: 80, y: 65 },
      { id: 'APC1', ruoli: ['A', 'Pc'], x: 50, y: 85 }
    ],
    linee: { portiere: 1, difesa: 4, centrocampo: 1, trequarti: 4, attacco: 1 }
  },
  '4-4-1-1': {
    // P, DD-DC-DC-DS, M-C-E/W-E/W, T/A, A/PC
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 1, C: 1, E: 2, W: 2, T: 1, A: 2, Pc: 1 },
    posizioni: [
      { id: 'P1', ruoli: ['Por'], x: 50, y: 8 },
      { id: 'DD1', ruoli: ['Dd'], x: 80, y: 25 }, { id: 'DC1', ruoli: ['Dc'], x: 60, y: 25 }, { id: 'DC2', ruoli: ['Dc'], x: 40, y: 25 }, { id: 'DS1', ruoli: ['Ds'], x: 20, y: 25 },
      { id: 'M1', ruoli: ['M'], x: 25, y: 50 }, { id: 'C1', ruoli: ['C'], x: 40, y: 55 }, { id: 'EW1', ruoli: ['E', 'W'], x: 60, y: 55 }, { id: 'EW2', ruoli: ['E', 'W'], x: 80, y: 50 },
      { id: 'TA1', ruoli: ['T', 'A'], x: 50, y: 70 },
      { id: 'APC1', ruoli: ['A', 'Pc'], x: 50, y: 85 }
    ],
    linee: { portiere: 1, difesa: 4, centrocampo: 4, trequarti: 1, attacco: 1 }
  },
  '4-2-3-1': {
    // P, DD-DC-DC-DS, M-M/C, W/T-T-W/A, A/PC
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 2, C: 1, W: 2, T: 2, A: 1, Pc: 1 },
    posizioni: [
      { id: 'P1', ruoli: ['Por'], x: 50, y: 8 },
      { id: 'DD1', ruoli: ['Dd'], x: 80, y: 25 }, { id: 'DC1', ruoli: ['Dc'], x: 60, y: 25 }, { id: 'DC2', ruoli: ['Dc'], x: 40, y: 25 }, { id: 'DS1', ruoli: ['Ds'], x: 20, y: 25 },
      { id: 'M1', ruoli: ['M'], x: 35, y: 45 }, { id: 'MC1', ruoli: ['M', 'C'], x: 65, y: 45 },
      { id: 'WT1', ruoli: ['W', 'T'], x: 25, y: 65 }, { id: 'T1', ruoli: ['T'], x: 50, y: 70 }, { id: 'WA1', ruoli: ['W', 'A'], x: 75, y: 65 },
      { id: 'APC1', ruoli: ['A', 'Pc'], x: 50, y: 85 }
    ],
    linee: { portiere: 1, difesa: 4, centrocampo: 2, trequarti: 3, attacco: 1 }
  }
};

// Funzioni per persistenza localStorage
const STORAGE_KEYS = {
  BUDGET: 'mantra-asta-budget',
  MODULI_TARGET: 'mantra-asta-moduli-target', 
  ROSA: 'mantra-asta-rosa',
  PREZZI_PAGATI: 'mantra-asta-prezzi-pagati',
  PREZZI_SUGGERITI: 'mantra-asta-prezzi-suggeriti',
  FASCE_MANUALI: 'mantra-asta-fasce-manuali',
  LARGHEZZA_LISTONE: 'mantra-asta-larghezza-listone',
  LARGHEZZA_ROSA: 'mantra-asta-larghezza-rosa',
  GIOCATORI_SCARTATI: 'mantra-asta-giocatori-scartati',
  GIOCATORI_PREFERITI: 'mantra-asta-giocatori-preferiti',
  NOTE_GIOCATORI: 'mantra-asta-note-giocatori'
};

const salvaInLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Errore nel salvare in localStorage:', error);
  }
};

const caricaDaLocalStorage = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (error) {
    console.warn('Errore nel caricare da localStorage:', error);
    return defaultValue;
  }
};

function App() {
  // Stati con valori caricati da localStorage
  const [budget, setBudget] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.BUDGET, 600));
  const [budgetMax] = useState(600);
  const [moduliTarget, setModuliTarget] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.MODULI_TARGET, ['4-2-3-1']));
  const [listone, setListone] = useState([]);
  const [rosa, setRosa] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.ROSA, []));
  const [giocatoriScartati, setGiocatoriScartati] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.GIOCATORI_SCARTATI, []));
  const [giocatoriPreferiti, setGiocatoriPreferiti] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.GIOCATORI_PREFERITI, []));
  const [noteGiocatori, setNoteGiocatori] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.NOTE_GIOCATORI, {}));
  const [tabAttiva, setTabAttiva] = useState('listone'); // 'listone' o 'scartati'
  const [filtroRuolo, setFiltroRuolo] = useState('TUTTI');
  const [filtroPreferiti, setFiltroPreferiti] = useState('TUTTI'); // 'TUTTI', 'PREFERITI', 'NON_PREFERITI'
  const [ricerca, setRicerca] = useState('');
  const [ordinamento, setOrdinamento] = useState('FVM');
  
  // Stati per il modal statistiche
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState(null);
  const [prezziPagati, setPrezziPagati] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.PREZZI_PAGATI, {}));
  const [prezziSuggeriti, setPrezziSuggeriti] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.PREZZI_SUGGERITI, {}));
  const [assegnazioniRuoli, setAssegnazioniRuoli] = useState(() => caricaDaLocalStorage('assegnazioniRuoli', {})); // giocatore.id -> ruolo assegnato
  const [larghezzaListone, setLarghezzaListone] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.LARGHEZZA_LISTONE, 40));
  const [larghezzaRosa, setLarghezzaRosa] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.LARGHEZZA_ROSA, 55));
  
  // Stati per sidebar preferiti, suggerimenti intelligenti e scroll
  const [sidebarPreferitiVisible, setSidebarPreferitiVisible] = useState(false);
  // Stato responsivo per adattare il layout colonne su mobile
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [focusedPlayerId, setFocusedPlayerId] = useState(null);
  const [preferitiListoneVisible, setPreferitiListoneVisible] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  
  // Definizioni fasce (senza range automatici)
  const fasceFVM = {
    supertop: { nome: 'Supertop', colore: 'bg-purple-500', sigla: 'S' },
    top: { nome: 'Top', colore: 'bg-blue-500', sigla: 'T' },
    buoni: { nome: 'Buoni', colore: 'bg-green-500', sigla: 'B' },
    scommesse: { nome: 'Scommesse', colore: 'bg-yellow-500', sigla: 'C' },
    daEvitare: { nome: 'Da evitare', colore: 'bg-red-500', sigla: 'D' }
  };
  const [filtroFascia, setFiltroFascia] = useState('TUTTE');
  const [fasceManuali, setFasceManuali] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.FASCE_MANUALI, {}));
  const [dropdownFasciaAperto, setDropdownFasciaAperto] = useState({}); // Non persistente

  // Chiudi dropdown fasce quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = () => {
      setDropdownFasciaAperto({});
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Carica automaticamente il listone all'avvio
  useEffect(() => {
    const caricaListoneAutomatico = async () => {
      try {
        console.log('🔄 Caricamento automatico del listone...');
        const response = await fetch('/listone.xlsx');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log('📊 Dati raw Excel:', data.slice(0, 5));
        
        if (data.length < 3) {
          throw new Error('File Excel troppo piccolo o formato non valido');
        }
        
        // Salta la prima riga (titolo) e usa la seconda come headers
        const headers = data[1];
        console.log('📋 Headers trovati:', headers);
        
        // Trova gli indici delle colonne importanti
        const indices = {
          nome: headers.findIndex(h => h && h.toString().toLowerCase().includes('nome')),
          squadra: headers.findIndex(h => h && h.toString().toLowerCase().includes('squadra')),
          ruolo: headers.findIndex(h => h && h.toString().toLowerCase() === 'rm'), // Ruolo MANTRA
          fvm: headers.findIndex(h => h && h.toString().toLowerCase().includes('fvm')),
          qa: headers.findIndex(h => h && (
            h.toString().toLowerCase() === 'qa' || 
            h.toString().toLowerCase().includes('quotazione') ||
            h.toString().toLowerCase() === 'q' ||
            h.toString().toLowerCase() === 'qt.a' ||
            h.toString().includes('Qt.A')
          )), // Quotazione - ricerca più flessibile
          prezzo: headers.findIndex(h => h && h.toString().toLowerCase().includes('prezzo'))
        };
        
        console.log('🔍 Indici colonne:', indices);
        
        // Processa i dati dalla riga 3 in poi
        const giocatori = data.slice(2).map((row, index) => {
          if (!row[indices.nome]) return null; // Salta righe vuote
          
          const ruoloCompleto = row[indices.ruolo] || '';
          const ruoloPrincipale = getRuoloPrincipale(ruoloCompleto);
          const fvm = parseFloat(row[indices.fvm]) || 0;
          const qa = parseFloat(row[indices.qa]) || 0;
          
          // Calcola prezzo suggerito: (FVM / 1000) * 600
          const prezzoSuggerito = Math.round((fvm / 1000) * 600) || 1;
          
          return {
            id: index + 1,
            nome: row[indices.nome],
            squadra: row[indices.squadra] || '',
            ruoloCompleto: ruoloCompleto,
            ruolo: ruoloPrincipale,
            fvm: fvm,
            qa: qa,
            prezzoSuggerito: prezzoSuggerito,
            prezzo: parseInt(row[indices.prezzo]) || 1
          };
        }).filter(Boolean); // Rimuovi elementi null
        
        console.log(`✅ Caricati ${giocatori.length} giocatori automaticamente`);
        console.log('👤 Primi giocatori:', giocatori.slice(0, 3));
        
        setListone(giocatori);
        
      } catch (error) {
        console.error('❌ Errore nel caricamento automatico del listone:', error);
        // Non settare errore bloccante, l'utente può sempre caricare manualmente
      }
    };

    caricaListoneAutomatico();
  }, []); // Solo all'avvio

  // Salva automaticamente quando cambiano i dati
  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.BUDGET, budget);
  }, [budget]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.MODULI_TARGET, moduliTarget);
  }, [moduliTarget]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.ROSA, rosa);
  }, [rosa]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.PREZZI_PAGATI, prezziPagati);
  }, [prezziPagati]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.PREZZI_SUGGERITI, prezziSuggeriti);
  }, [prezziSuggeriti]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.FASCE_MANUALI, fasceManuali);
  }, [fasceManuali]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.LARGHEZZA_LISTONE, larghezzaListone);
  }, [larghezzaListone]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.LARGHEZZA_ROSA, larghezzaRosa);
  }, [larghezzaRosa]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.GIOCATORI_SCARTATI, giocatoriScartati);
  }, [giocatoriScartati]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.GIOCATORI_PREFERITI, giocatoriPreferiti);
  }, [giocatoriPreferiti]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.NOTE_GIOCATORI, noteGiocatori);
  }, [noteGiocatori]);

  useEffect(() => {
    salvaInLocalStorage('assegnazioniRuoli', assegnazioniRuoli);
  }, [assegnazioniRuoli]);

  // Funzioni per gestione dati
  const esportaDatiAsta = () => {
    const datiAsta = {
      budget,
      moduliTarget,
      rosa,
      prezziPagati,
      prezziSuggeriti,
      assegnazioniRuoli,
      fasceManuali,
      larghezzaListone,
      larghezzaRosa,
      giocatoriScartati,
      giocatoriPreferiti,
      noteGiocatori,
      dataEsportazione: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(datiAsta, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asta-mantra-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importaDatiAsta = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const datiAsta = JSON.parse(e.target.result);
        
        if (datiAsta.budget !== undefined) setBudget(datiAsta.budget);
        if (datiAsta.moduliTarget) setModuliTarget(datiAsta.moduliTarget);
        if (datiAsta.rosa) setRosa(datiAsta.rosa);
        if (datiAsta.prezziPagati) setPrezziPagati(datiAsta.prezziPagati);
        if (datiAsta.prezziSuggeriti) setPrezziSuggeriti(datiAsta.prezziSuggeriti);
        if (datiAsta.assegnazioniRuoli) setAssegnazioniRuoli(datiAsta.assegnazioniRuoli);
        if (datiAsta.fasceManuali) setFasceManuali(datiAsta.fasceManuali);
        if (datiAsta.larghezzaListone !== undefined) setLarghezzaListone(datiAsta.larghezzaListone);
        if (datiAsta.larghezzaRosa !== undefined) setLarghezzaRosa(datiAsta.larghezzaRosa);
        if (datiAsta.giocatoriScartati) setGiocatoriScartati(datiAsta.giocatoriScartati);
        if (datiAsta.giocatoriPreferiti) setGiocatoriPreferiti(datiAsta.giocatoriPreferiti);
        if (datiAsta.noteGiocatori) setNoteGiocatori(datiAsta.noteGiocatori);
        
        alert('✅ Dati asta importati con successo!');
      } catch (error) {
        alert('❌ Errore nell\'importazione del file: ' + error.message);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  const resetDatiAsta = () => {
    if (confirm('⚠️ Sei sicuro di voler resettare tutti i dati dell\'asta? Questa azione non è reversibile.')) {
      // Reset localStorage
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      
      // Reset stati
      setBudget(600);
      setModuliTarget(['4-2-3-1']);
      setRosa([]);
      setPrezziPagati({});
      setFasceManuali({});
      setLarghezzaListone(40);
      setGiocatoriScartati([]);
      setGiocatoriPreferiti([]);
      setNoteGiocatori({});
      
      alert('✅ Dati asta resettati!');
    }
  };

  // Funzioni per gestione giocatori scartati
  const scartaGiocatore = (giocatore) => {
    const key = `${giocatore.nome}_${giocatore.squadra}`;
    if (!giocatoriScartati.includes(key)) {
      setGiocatoriScartati(prev => [...prev, key]);
    }
  };

  const ripristinaGiocatore = (giocatore) => {
    const key = `${giocatore.nome}_${giocatore.squadra}`;
    setGiocatoriScartati(prev => prev.filter(g => g !== key));
  };

  const isGiocatoreScartato = (giocatore) => {
    const key = `${giocatore.nome}_${giocatore.squadra}`;
    return giocatoriScartati.includes(key);
  };

  // Funzioni per gestione giocatori preferiti
  const toggleGiocatorePreferito = (giocatore) => {
    const key = `${giocatore.nome}_${giocatore.squadra}`;
    setGiocatoriPreferiti(prev => 
      prev.includes(key) 
        ? prev.filter(g => g !== key)
        : [...prev, key]
    );
  };

  const isGiocatorePreferito = (giocatore) => {
    const key = `${giocatore.nome}_${giocatore.squadra}`;
    return giocatoriPreferiti.includes(key);
  };

  // Funzioni per gestione note giocatori
  const aggiornaNoteGiocatore = (giocatore, nota) => {
    const key = `${giocatore.nome}_${giocatore.squadra}`;
    setNoteGiocatori(prev => ({
      ...prev,
      [key]: nota
    }));
  };

  const getNoteGiocatore = (giocatore) => {
    const key = `${giocatore.nome}_${giocatore.squadra}`;
    return noteGiocatori[key] || '';
  };

  // Funzioni per gestione prezzi suggeriti personalizzati
  const aggiornaPrezzosuggerito = (giocatore, nuovoPrezzo) => {
    const key = `${giocatore.nome}_${giocatore.squadra}`;
    if (nuovoPrezzo === '' || nuovoPrezzo === null || nuovoPrezzo === undefined) {
      // Rimuovi prezzo personalizzato se vuoto
      setPrezziSuggeriti(prev => {
        const nuovo = { ...prev };
        delete nuovo[key];
        return nuovo;
      });
    } else {
      setPrezziSuggeriti(prev => ({
        ...prev,
        [key]: parseInt(nuovoPrezzo) || 0
      }));
    }
  };

  // Funzioni per gestione assegnazioni ruoli
  const assegnaGiocatoreARuolo = (giocatore, nuovoRuolo) => {
    setAssegnazioniRuoli(prev => ({
      ...prev,
      [giocatore.id]: nuovoRuolo
    }));
  };

  const rimuoviAssegnazioneRuolo = (giocatore) => {
    setAssegnazioniRuoli(prev => {
      const nuove = { ...prev };
      delete nuove[giocatore.id];
      return nuove;
    });
  };

  const getRuoloAssegnato = (giocatore) => {
    return assegnazioniRuoli[giocatore.id] || null;
  };

  // State e funzioni per drag and drop tra ruoli
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [dragOverRole, setDragOverRole] = useState(null);

  const handlePlayerDragStart = (e, giocatore) => {
    setDraggedPlayer(giocatore);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRoleDragOver = (e, ruolo) => {
    e.preventDefault();
    if (draggedPlayer && getTuttiRuoli(draggedPlayer.ruoloCompleto).includes(ruolo)) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverRole(ruolo);
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleRoleDragEnter = (e, ruolo) => {
    e.preventDefault();
    if (draggedPlayer && getTuttiRuoli(draggedPlayer.ruoloCompleto).includes(ruolo)) {
      setDragOverRole(ruolo);
    }
  };

  const handleRoleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverRole(null);
    }
  };

  const handleRoleDrop = (e, ruolo) => {
    e.preventDefault();
    if (draggedPlayer && getTuttiRuoli(draggedPlayer.ruoloCompleto).includes(ruolo)) {
      assegnaGiocatoreARuolo(draggedPlayer, ruolo);
    }
    setDraggedPlayer(null);
    setDragOverRole(null);
  };

  const handlePlayerDragEnd = () => {
    setDraggedPlayer(null);
    setDragOverRole(null);
  };

  // Ottieni giocatori raggruppati per ruolo assegnato
  const getGiocatoriPerRuolo = () => {
    const raggruppamento = {};
    
    // Inizializza tutti i ruoli richiesti
    Object.keys(rosaNecessaria.ruoli).forEach(ruolo => {
      raggruppamento[ruolo] = [];
    });
    
    // Raggruppa i giocatori senza duplicati
    rosa.forEach(giocatore => {
      const ruoloAssegnato = getRuoloAssegnato(giocatore);
      
      if (ruoloAssegnato && raggruppamento[ruoloAssegnato]) {
        // Se ha un'assegnazione specifica, mettilo solo lì
        raggruppamento[ruoloAssegnato].push(giocatore);
      } else {
        // Se non ha assegnazione, mettilo in tutti i ruoli che può ricoprire
        const ruoliGiocatore = getTuttiRuoli(giocatore.ruoloCompleto);
        ruoliGiocatore.forEach(ruolo => {
          if (raggruppamento[ruolo]) {
            raggruppamento[ruolo].push(giocatore);
          }
        });
      }
    });
    
    return raggruppamento;
  };

  const getPrezzoSuggerito = (giocatore) => {
    const key = `${giocatore.nome}_${giocatore.squadra}`;
    // Se c'è un prezzo personalizzato, usalo, altrimenti usa quello originale
    return prezziSuggeriti[key] !== undefined 
      ? prezziSuggeriti[key] 
      : (giocatore.prezzoSuggerito || giocatore.FVM || 1);
  };

  // Funzione per calcolare la percentuale del budget
  const calcolaPercentuale = (valore) => {
    if (!valore || valore <= 0) return "0.0";
    return ((valore / budgetMax) * 100).toFixed(1);
  };

  // Funzione per formattare prezzo con percentuale
  const formatPrezzoConPercentuale = (valore) => {
    const percentuale = calcolaPercentuale(valore);
    return `${valore} FM (${percentuale}%)`;
  };

  // Funzione per evidenziare e scrollare a un giocatore specifico
  const focusGiocatore = (giocatore) => {
    const playerId = `${giocatore.nome}_${giocatore.squadra}`;
    setFocusedPlayerId(playerId);
    
    // Rimuovi evidenziazione dopo 3 secondi
    setTimeout(() => {
      setFocusedPlayerId(null);
    }, 3000);
    
    // Scroll a giocatore se non è visibile
    setTimeout(() => {
      const elemento = document.getElementById(`player-${playerId}`);
      if (elemento) {
        elemento.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 100);
    
    // Imposta filtri per mostrare il giocatore
    setTabAttiva('listone');
    setFiltroRuolo('TUTTI');
    setFiltroPreferiti('TUTTI');
    setRicerca('');
  };

  // Crea array di giocatori preferiti con tutti i dati
  const giocatoriPreferitiCompleti = useMemo(() => {
    return listone.filter(giocatore => {
      const key = `${giocatore.nome}_${giocatore.squadra}`;
      return giocatoriPreferiti.includes(key);
    });
  }, [listone, giocatoriPreferiti]);

  // Funzioni per gestire il modal statistiche
  const openPlayerStats = (giocatore) => {
    setSelectedPlayerForStats(giocatore);
    setStatsModalOpen(true);
  };

  const closePlayerStats = () => {
    setStatsModalOpen(false);
    setSelectedPlayerForStats(null);
  };
  

  
  // Calcolo dinamico rosa necessaria per ruoli specifici (32 giocatori totali)
  const rosaNecessaria = useMemo(() => {
    if (moduliTarget.length === 0) {
      // Se nessun modulo selezionato, inizializza tutti i ruoli con 0 tranne Por
      const ruoliBase = { 'Por': 3 };
      Object.keys(RUOLI_MANTRA).forEach(ruolo => {
        if (ruolo !== 'Por') {
          ruoliBase[ruolo] = 0; // Tutti opzionali per flessibilità
        }
      });
      
      return {
        ruoli: ruoliBase,
        linee: { 'portiere': 3, 'difesa': 0, 'centrocampo': 0, 'attacco': 0, 'trequarti': 0 },
        offensivi: {}
      };
    }

    const modulo = moduliTarget[0]; // Usa il primo modulo selezionato
    const config = CONFIGURAZIONE_MODULI[modulo];
    
    if (!config) {
      // Se configurazione modulo non trovata, mostra tutti i ruoli con 0 tranne Por
      const ruoliBase = { 'Por': 3 };
      Object.keys(RUOLI_MANTRA).forEach(ruolo => {
        if (ruolo !== 'Por') {
          ruoliBase[ruolo] = 0; // Tutti opzionali per flessibilità
        }
      });
      
      return {
        ruoli: ruoliBase,
        linee: { 'portiere': 3, 'difesa': 0, 'centrocampo': 0, 'attacco': 0, 'trequarti': 0 },
        offensivi: {}
      };
    }

    const requisitiRuoli = { 'Por': 3 }; // Sempre 3 portieri
    const requisitiLinee = { 'portiere': 3 };
    const requisitiOffensivi = {};
    
    // Inizializza tutti i ruoli MANTRA con 0 per flessibilità (eccetto Por)
    Object.keys(RUOLI_MANTRA).forEach(ruolo => {
      if (ruolo !== 'Por') {
        requisitiRuoli[ruolo] = 0;
      }
    });
    
    // Mappa per prioritizzare ruoli più offensivi
    const ruoliOffensiviPreferiti = {
      'M': 'C',     // Preferisci C invece di M
      'Dc': 'Dc',   // Dc rimane Dc
      'Dd': 'Dd',   // Dd rimane Dd  
      'Ds': 'Ds',   // Ds rimane Ds
      'A': 'Pc',    // Preferisci Pc invece di A dove possibile
      'T': 'T',     // T rimane T
      'C': 'C',     // C rimane C
      'W': 'W',     // W rimane W
      'E': 'E'      // E rimane E
    };
    
    // Calcola i requisiti per ruoli usando la formula (slot × 2) + 1
    Object.entries(config.ruoli).forEach(([ruolo, slot]) => {
      if (ruolo !== 'Por') {
        const ruoloPreferito = ruoliOffensiviPreferiti[ruolo] || ruolo;
        const necessari = (slot * 2) + 1;
        
        // Usa il ruolo più offensivo possibile
        if (!requisitiRuoli[ruoloPreferito]) {
          requisitiRuoli[ruoloPreferito] = 0;
        }
        requisitiRuoli[ruoloPreferito] = Math.max(requisitiRuoli[ruoloPreferito], necessari);
        
        // Calcola anche requisiti per linee
        const ruoloInfo = RUOLI_MANTRA[ruoloPreferito];
        if (ruoloInfo) {
          const linea = ruoloInfo.linea;
          if (!requisitiLinee[linea]) requisitiLinee[linea] = 0;
          requisitiLinee[linea] += necessari;
        }
      }
    });
    
    // Aggiusta le linee per non superare 32 totali
    const totaleRuoli = Object.values(requisitiRuoli).reduce((sum, val) => sum + val, 0);
    if (totaleRuoli > 32) {
      // Riduci proporzionalmente mantenendo i minimi
      const eccesso = totaleRuoli - 32;
      const ruoliRiducibili = Object.entries(requisitiRuoli)
        .filter(([ruolo]) => ruolo !== 'Por' && requisitiRuoli[ruolo] > 3);
      
      let riduzione = eccesso;
      ruoliRiducibili.forEach(([ruolo, valore]) => {
        if (riduzione > 0) {
          const riduzioneRuolo = Math.min(riduzione, valore - 3);
          requisitiRuoli[ruolo] -= riduzioneRuolo;
          riduzione -= riduzioneRuolo;
        }
      });
    }
    
    // Ricalcola le linee basate sui ruoli finali
    const nuoveLinee = { 'portiere': 3 };
    Object.entries(requisitiRuoli).forEach(([ruolo, necessari]) => {
      if (ruolo !== 'Por') {
        const ruoloInfo = RUOLI_MANTRA[ruolo];
        if (ruoloInfo) {
          const linea = ruoloInfo.linea;
          if (!nuoveLinee[linea]) nuoveLinee[linea] = 0;
          nuoveLinee[linea] += necessari;
        }
      }
    });
    
    Object.assign(requisitiLinee, nuoveLinee);
    
    return { ruoli: requisitiRuoli, linee: requisitiLinee, offensivi: requisitiOffensivi };
  }, [moduliTarget]);

  // Conteggio giocatori per ruolo specifico e linea nella rosa attuale
  const conteggioRosa = useMemo(() => {
    const conteggioRuoli = {};
    const conteggioLinee = {};
    
    rosa.forEach(giocatore => {
      // Se il giocatore ha un'assegnazione specifica, usa quella
      const ruoloAssegnato = assegnazioniRuoli[giocatore.id];
      
      if (ruoloAssegnato) {
        // Conta solo per il ruolo assegnato
        const ruoloInfo = RUOLI_MANTRA[ruoloAssegnato];
        if (ruoloInfo) {
          conteggioRuoli[ruoloAssegnato] = (conteggioRuoli[ruoloAssegnato] || 0) + 1;
          const linea = ruoloInfo.linea;
          conteggioLinee[linea] = (conteggioLinee[linea] || 0) + 1;
        }
      } else {
        // Conta il giocatore per TUTTI i ruoli che può ricoprire (comportamento predefinito)
        const ruoliGiocatore = getTuttiRuoli(giocatore.ruoloCompleto);
        
        ruoliGiocatore.forEach(ruoloSingolo => {
          const ruoloInfo = RUOLI_MANTRA[ruoloSingolo];
          if (ruoloInfo) {
            // Conteggio per ruolo specifico
            conteggioRuoli[ruoloSingolo] = (conteggioRuoli[ruoloSingolo] || 0) + 1;
            
            // Conteggio per linea
            const linea = ruoloInfo.linea;
            conteggioLinee[linea] = (conteggioLinee[linea] || 0) + 1;
          }
        });
      }
    });
    
    return { ruoli: conteggioRuoli, linee: conteggioLinee };
  }, [rosa, assegnazioniRuoli]);

  // Parser Excel per listone Fantacalcio
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          console.log('📊 Prime righe Excel:', jsonData.slice(0, 3));
          
          // Salta la prima riga (titolo) e usa la seconda come header
          if (jsonData.length < 3) {
            throw new Error('File Excel non ha abbastanza righe');
          }
          
          const headers = jsonData[1]; // Seconda riga = headers veri
          const giocatori = jsonData.slice(2).map((row, index) => { // Dalla terza riga
            const ruoloCompleto = row[headers.indexOf('RM')] || '';
            const giocatore = {
              id: index,
              nome: row[headers.indexOf('Nome')] || '',
              squadra: row[headers.indexOf('Squadra')] || '',
              ruoloCompleto: ruoloCompleto, // Ruoli multipli originali
              ruolo: getRuoloPrincipale(ruoloCompleto), // Ruolo più difensivo
              fvm: parseFloat(row[headers.indexOf('FVM')]) || 0,
              prezzo: parseInt(row[headers.indexOf('Qt.A')]) || 1, // Quotazione attuale
              idOriginale: row[headers.indexOf('Id')] || index
            };
            
            return giocatore;
          }).filter(g => g.nome && g.ruolo); // Solo giocatori validi
          
          console.log(`✅ Importati ${giocatori.length} giocatori`);
          console.log('🧪 Primo giocatore:', giocatori[0]);
          setListone(giocatori);
        } catch (error) {
          console.error('❌ Errore nel parsing del file Excel:', error);
          alert(`Errore nel caricamento del file: ${error.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Funzione helper per applicare i filtri comuni
  const applicaFiltri = (giocatori, includiScartati = false) => {
    return giocatori.filter(giocatore => {
      const matchRicerca = !ricerca || 
        giocatore.nome?.toLowerCase().includes(ricerca.toLowerCase()) ||
        giocatore.squadra?.toLowerCase().includes(ricerca.toLowerCase());
      
      // Nuovo filtro per ruoli specifici che supporta ruoli multipli
      const matchRuolo = filtroRuolo === 'TUTTI' || (() => {
        // Per ruoli multipli, controlla se il ruolo filtrato è presente in qualsiasi posizione
        const tuttiriRuoli = getTuttiRuoli(giocatore.ruoloCompleto || giocatore.ruolo || '');
        return tuttiriRuoli.includes(filtroRuolo);
      })();
      
      // Filtro per fascia (automatica + manuale)
      const fasciaGiocatore = getFasciaGiocatore(giocatore.id, giocatore.fvm, fasceManuali, fasceFVM, giocatore.ruolo, listone);
      const matchFascia = filtroFascia === 'TUTTE' || fasciaGiocatore.key === filtroFascia;
      
      // Filtro per preferiti
      const matchPreferiti = filtroPreferiti === 'TUTTI' || 
        (filtroPreferiti === 'PREFERITI' && isGiocatorePreferito(giocatore)) ||
        (filtroPreferiti === 'NON_PREFERITI' && !isGiocatorePreferito(giocatore));
      
      // Controllo se includere o escludere giocatori scartati
      const condizioneScartati = includiScartati 
        ? isGiocatoreScartato(giocatore)  // Solo giocatori scartati
        : !isGiocatoreScartato(giocatore); // Solo giocatori non scartati
      
      return matchRicerca && matchRuolo && matchFascia && matchPreferiti && condizioneScartati;
    });
  };

  // Funzione helper per ordinamento
  const ordinaGiocatori = (giocatori) => {
    return giocatori.sort((a, b) => {
      switch (ordinamento) {
        case 'FVM':
          return (b.fvm || 0) - (a.fvm || 0);
        case 'FASCIA':
          // Ordina per fascia (automatica + manuale) (Top → Da evitare)
          const fasciaOrder = ['top', 'supertop', 'buoni', 'scommesse', 'daEvitare'];
          const fasciaA = getFasciaGiocatore(a.id, a.fvm, fasceManuali, fasceFVM, a.ruolo, listone).key;
          const fasciaB = getFasciaGiocatore(b.id, b.fvm, fasceManuali, fasceFVM, b.ruolo, listone).key;
          const orderA = fasciaOrder.indexOf(fasciaA);
          const orderB = fasciaOrder.indexOf(fasciaB);
          if (orderA !== orderB) return orderA - orderB;
          // Se stessa fascia, ordina per FVM
          return (b.fvm || 0) - (a.fvm || 0);
        case 'NOME':
          return (a.nome || '').localeCompare(b.nome || '');
        case 'SQUADRA':
          return (a.squadra || '').localeCompare(b.squadra || '');
        default:
          return 0;
      }
    });
  };

  // Filtro e ordinamento per listone attivo
  const listoneFiltered = useMemo(() => {
    const filtered = applicaFiltri(listone, false); // Escludi scartati
    return ordinaGiocatori([...filtered]);
  }, [listone, ricerca, filtroRuolo, filtroFascia, filtroPreferiti, ordinamento, fasceManuali, giocatoriScartati, giocatoriPreferiti]);

  // Filtro e ordinamento per giocatori scartati
  const giocatoriScartatiFiltered = useMemo(() => {
    const filtered = applicaFiltri(listone, true); // Solo scartati
    return ordinaGiocatori([...filtered]);
  }, [listone, ricerca, filtroRuolo, filtroFascia, filtroPreferiti, ordinamento, fasceManuali, giocatoriScartati, giocatoriPreferiti]);

  // Aggiungi giocatore alla rosa con gestione prezzo pagato
  const aggiungiGiocatore = (giocatore) => {
    if (!rosa.find(g => g.id === giocatore.id)) {
      const prezzoPagato = prezziPagati[giocatore.id] || getPrezzoSuggerito(giocatore);
      setRosa([...rosa, giocatore]);
      setBudget(prev => prev - prezzoPagato);
    }
  };

  // Rimuovi giocatore dalla rosa
  const rimuoviGiocatore = (giocatore) => {
    const prezzoPagato = prezziPagati[giocatore.id] || getPrezzoSuggerito(giocatore);
    setRosa(rosa.filter(g => g.id !== giocatore.id));
    setBudget(prev => prev + prezzoPagato);
    // Rimuovi anche il prezzo pagato memorizzato
    setPrezziPagati(prev => {
      const nuovo = { ...prev };
      delete nuovo[giocatore.id];
      return nuovo;
    });
  };

  // Aggiorna prezzo pagato per un giocatore
  const aggiornaPrezzoGiocatore = (giocatore, nuovoPrezzo) => {
    const vecchioPrezzo = prezziPagati[giocatore.id] || getPrezzoSuggerito(giocatore);
    const differenza = nuovoPrezzo - vecchioPrezzo;
    
    setPrezziPagati(prev => ({
      ...prev,
      [giocatore.id]: nuovoPrezzo
    }));
    
    // Aggiorna budget solo se il giocatore è in rosa
    if (rosa.find(g => g.id === giocatore.id)) {
      setBudget(prev => prev - differenza);
    }
  };

  // Verifica moduli con ruoli specifici calcolati
  const verificaModuli = () => {
    return moduliTarget.map(modulo => {
      const config = CONFIGURAZIONE_MODULI[modulo];
      const verificato = Object.entries(config.ruoli).every(([ruolo, slot]) => {
        if (slot === 0) return true; // Ruoli non richiesti sono sempre OK
        const disponibili = conteggioRosa.ruoli[ruolo] || 0;
        const necessariCalcolati = (slot * 2) + 1;
        return disponibili >= necessariCalcolati;
      });
      
      return { modulo, verificato, config };
    });
  };


  // Suggerimenti intelligenti e contestuali
  const suggerimenti = useMemo(() => {
    const suggerimentiList = [];
    const budgetRimanente = budget;
    const giocatoriRosa = rosa.length;
    
    // Solo se non siamo all'inizio (almeno 1-2 giocatori in rosa)
    if (giocatoriRosa === 0) {
      suggerimentiList.push({
        tipo: 'iniziale',
        messaggio: `💡 Inizia con un portiere o un difensore forte per assicurarti le basi`,
        priorita: 'media'
      });
      return suggerimentiList;
    }
    
    // Suggerimenti prioritari per carenze critiche
    const carenzeCritiche = [];
    Object.entries(rosaNecessaria.linee).forEach(([linea, necessari]) => {
      const attuali = conteggioRosa.linee[linea] || 0;
      if (attuali < necessari) {
        const mancanti = necessari - attuali;
        carenzeCritiche.push({ linea, mancanti, priorita: mancanti > 2 ? 'alta' : 'media' });
      }
    });

    // Ordina le carenze per priorità
    carenzeCritiche.sort((a, b) => b.mancanti - a.mancanti);
    
    carenzeCritiche.forEach(({ linea, mancanti, priorita }) => {
      // Suggerimenti specifici per fascia di prezzo
      const budgetPerGiocatore = Math.floor(budgetRimanente / Math.max(1, (32 - giocatoriRosa)));
      let fasciaConsigliata = 'Buoni';
      
      if (budgetPerGiocatore > 40) fasciaConsigliata = 'Top o Supertop';
      else if (budgetPerGiocatore > 25) fasciaConsigliata = 'Top';
      else if (budgetPerGiocatore > 15) fasciaConsigliata = 'Buoni';
      else fasciaConsigliata = 'Scommesse';
      
      suggerimentiList.push({
        tipo: 'carenza',
        messaggio: `🚨 URGENTE: Ti mancano ${mancanti} giocatori in ${linea} - Punta su fascia ${fasciaConsigliata} (≤${budgetPerGiocatore} crediti)`,
        priorita
      });
    });

    // Suggerimenti sui requisiti offensivi solo se abbiamo già qualche giocatore
    if (giocatoriRosa >= 5) {
      Object.entries(rosaNecessaria.offensivi).forEach(([ruolo, necessari]) => {
        const attuali = conteggioRosa.ruoli[ruolo] || 0;
        if (attuali < necessari) {
          const ruoloDifensivo = Object.keys(RUOLO_OFFENSIVO_MAP).find(k => RUOLO_OFFENSIVO_MAP[k] === ruolo);
          const siglaDifensiva = RUOLI_MANTRA[ruoloDifensivo]?.sigla;
          const siglaOffensiva = RUOLI_MANTRA[ruolo]?.sigla;
          
          suggerimentiList.push({
            tipo: 'offensivo',
            messaggio: `⚽ Serve almeno ${necessari - attuali} ${siglaOffensiva} più offensivi (da ${siglaDifensiva})`,
            priorita: 'alta'
          });
        }
      });
    }

    // Suggerimenti di bilanciamento budget
    if (giocatoriRosa >= 15) {
      const budgetMedio = budgetRimanente / Math.max(1, (32 - giocatoriRosa));
      if (budgetMedio < 8) {
        suggerimentiList.push({
          tipo: 'budget',
          messaggio: `💰 Budget basso! Concentrati su Scommesse e occasioni (≤8 crediti a testa)`,
          priorita: 'alta'
        });
      } else if (budgetMedio > 40) {
        suggerimentiList.push({
          tipo: 'budget', 
          messaggio: `💎 Budget abbondante! Puoi puntare su Top/Supertop (${Math.floor(budgetMedio)} crediti disponibili a testa)`,
          priorita: 'media'
        });
      }
    }

    // Suggerimenti specifici sui ruoli più urgenti (solo se siamo a metà asta)
    if (giocatoriRosa >= 8) {
      const ruoliUrgenti = Object.entries(rosaNecessaria.ruoli)
        .filter(([ruolo, necessari]) => {
          const attuali = conteggioRosa.ruoli[ruolo] || 0;
          return attuali < necessari;
        })
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2);
      
      if (ruoliUrgenti.length > 0) {
        const ruoliMsg = ruoliUrgenti.map(([ruolo]) => RUOLI_MANTRA[ruolo]?.sigla || ruolo).join(', ');
        suggerimentiList.push({
          tipo: 'ruoli',
          messaggio: `🎯 Focus su: ${ruoliMsg} - Mancano questi ruoli specifici`,
          priorita: 'media'
        });
      }
    }

    // Suggerimento finale
    if (giocatoriRosa >= 28) {
      suggerimentiList.push({
        tipo: 'finale',
        messaggio: `🏁 Quasi finito! Completa con gli ultimi ${32 - giocatoriRosa} giocatori più convenienti`,
        priorita: 'bassa'
      });
    }

    return suggerimentiList.slice(0, 4); // Massimo 4 suggerimenti
  }, [rosaNecessaria, conteggioRosa, rosa, budget]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">FANTAHUSTLER</h1>
              {/* Scudetto Team Eno */}
              <div className="flex items-center bg-white border-2 border-red-500 px-3 py-1 rounded-lg shadow-lg">
                <svg 
                  className="w-6 h-6 mr-2" 
                  viewBox="0 0 100 100" 
                  fill="none"
                >
                  {/* Scudetto outline */}
                  <path 
                    d="M50 5 L85 20 L85 60 C85 75 50 90 50 90 C50 90 15 75 15 60 L15 20 Z" 
                    fill="white" 
                    stroke="#EF4444" 
                    strokeWidth="3"
                  />
                  {/* Inner shield */}
                  <path 
                    d="M50 15 L75 25 L75 55 C75 65 50 75 50 75 C50 75 25 65 25 55 L25 25 Z" 
                    fill="white" 
                    stroke="#EF4444" 
                    strokeWidth="2"
                  />
                  {/* Baseball player figure */}
                  <g fill="#EF4444">
                    {/* Head */}
                    <circle cx="45" cy="35" r="4"/>
                    {/* Body */}
                    <ellipse cx="45" cy="45" rx="3" ry="6"/>
                    {/* Left arm with bat */}
                    <path d="M42 40 L35 35 L34 37 L41 42 Z"/>
                    {/* Bat */}
                    <rect x="32" y="33" width="8" height="1.5" rx="0.5"/>
                    {/* Right arm */}
                    <path d="M48 42 L53 38 L52 36 L47 40 Z"/>
                    {/* Left leg */}
                    <ellipse cx="42" cy="55" rx="2" ry="5" transform="rotate(-15 42 55)"/>
                    {/* Right leg */}
                    <ellipse cx="48" cy="55" rx="2" ry="5" transform="rotate(15 48 55)"/>
                  </g>
                  {/* Letter E */}
                  <path 
                    d="M60 35 L60 55 L68 55 M60 35 L67 35 M60 45 L65 45" 
                    stroke="#EF4444" 
                    strokeWidth="2" 
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-sm font-bold text-red-500">TEAM ENO</span>
              </div>
            </div>
            <div className="flex items-center space-x-4 flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs sm:text-sm font-medium text-gray-500">BUDGET:</span>
                <span className={`text-xl sm:text-lg font-bold ${budget < 50 ? 'text-red-600' : 'text-green-600'}`}>
                  {budget}/{budgetMax} FM
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs sm:text-sm">
                <span className="text-gray-500">Utilizzato:</span>
                <span className={`font-bold ${budgetMax - budget > budgetMax * 0.7 ? 'text-red-600' : 'text-blue-600'}`}>
                  {budgetMax - budget} FM ({calcolaPercentuale(budgetMax - budget)}%)
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs sm:text-sm">
                <span className="text-gray-500">Rimanente:</span>
                <span className={`font-bold ${budget < 50 ? 'text-red-600' : 'text-green-600'}`}>
                  {budget} FM ({calcolaPercentuale(budget)}%)
                </span>
              </div>
            </div>
          </div>
          
          {/* Controlli Persistenza */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSidebarPreferitiVisible(!sidebarPreferitiVisible)}
              className={`px-3 py-1 text-sm rounded transition-colors flex items-center space-x-1 ${
                sidebarPreferitiVisible 
                  ? 'bg-pink-600 text-white hover:bg-pink-700' 
                  : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
              }`}
              title="Mostra/Nascondi preferiti"
            >
              <span>❤️</span>
              <span>Preferiti ({giocatoriPreferitiCompleti.length})</span>
            </button>
            
            <button
              onClick={esportaDatiAsta}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              title="Esporta tutti i dati dell'asta in un file JSON"
            >
              📤 Esporta
            </button>
            
            <label className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors cursor-pointer" title="Importa dati asta da file JSON">
              📥 Importa
              <input
                type="file"
                accept=".json"
                onChange={importaDatiAsta}
                className="hidden"
              />
            </label>
            
            <button
              onClick={resetDatiAsta}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              title="Reset completo dei dati"
            >
              🔄 Reset
            </button>
            
            <div className="text-xs text-gray-500">
              💾 Auto-salvataggio attivo
            </div>
          </div>
        </div>
        
        {/* Seconda riga con moduli target */}
        <div className="mt-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-sm font-medium text-gray-500">MODULI TARGET:</span>
            <div className="flex flex-wrap gap-1">
              {moduliTarget.map(modulo => (
                <span key={modulo} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  {modulo}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {MODULI_TARGET_DEFAULT.map(modulo => (
              <button
                key={modulo}
                onClick={() => {
                  setModuliTarget(prev => 
                    prev.includes(modulo) 
                      ? prev.filter(m => m !== modulo)
                      : [...prev, modulo]
                  );
                }}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  moduliTarget.includes(modulo)
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {modulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        {/* Sezione Listone/Scartati (dinamica %) */}
        <div className="flex flex-col bg-white border-r border-gray-200" style={{ width: isMobile ? '100%' : `${larghezzaListone}%` }}>
          {/* Header con Tab */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                {/* Tab Navigation */}
                <div className="flex border-b">
                  <button
                    onClick={() => setTabAttiva('listone')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      tabAttiva === 'listone'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    📋 LISTONE ({listoneFiltered.length})
                  </button>
                  <button
                    onClick={() => setTabAttiva('scartati')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      tabAttiva === 'scartati'
                        ? 'border-red-600 text-red-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    🗑️ SCARTATI ({giocatoriScartati.length})
                  </button>
                </div>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload" className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Carica Excel
              </label>
            </div>

                        <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {/* Filtro TUTTI */}
                <button
                  onClick={() => setFiltroRuolo('TUTTI')}
                  className={`px-3 py-1 text-sm font-medium rounded ${
                    filtroRuolo === 'TUTTI'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  TUTTI
                </button>
                

                
                {/* Portieri */}
                <button
                  onClick={() => setFiltroRuolo('Por')}
                  className={`px-3 py-1 text-sm font-medium rounded ${
                    filtroRuolo === 'Por'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  }`}
                >
                  P
                </button>
                
                {/* Difensori */}
                {['B', 'Ds', 'Dc', 'Dd'].map(ruolo => (
                  <button
                    key={ruolo}
                    onClick={() => setFiltroRuolo(ruolo)}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      filtroRuolo === ruolo
                        ? 'bg-green-700 text-white'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {RUOLI_MANTRA[ruolo]?.sigla || ruolo}
                  </button>
                ))}
                
                {/* Centrocampisti */}
                {['E', 'M', 'C'].map(ruolo => (
                  <button
                    key={ruolo}
                    onClick={() => setFiltroRuolo(ruolo)}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      filtroRuolo === ruolo
                        ? 'bg-blue-700 text-white'
                        : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                    }`}
                  >
                    {RUOLI_MANTRA[ruolo]?.sigla || ruolo}
                  </button>
                ))}
                
                {/* Trequartisti */}
                {['W', 'T'].map(ruolo => (
                  <button
                    key={ruolo}
                    onClick={() => setFiltroRuolo(ruolo)}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      filtroRuolo === ruolo
                        ? 'bg-purple-700 text-white'
                        : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                    }`}
                  >
                    {RUOLI_MANTRA[ruolo]?.sigla || ruolo}
                  </button>
                ))}
                
                {/* Attaccanti */}
                {['A', 'Pc'].map(ruolo => (
                  <button
                    key={ruolo}
                    onClick={() => setFiltroRuolo(ruolo)}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      filtroRuolo === ruolo
                        ? 'bg-red-700 text-white'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    {RUOLI_MANTRA[ruolo]?.sigla || ruolo}
                  </button>
                ))}
              </div>

              {/* Filtri Fasce */}
              <div className="mt-3">
                <div className="text-xs font-medium text-gray-700 mb-2">Filtri per Fascia FVM:</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFiltroFascia('TUTTE')}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      filtroFascia === 'TUTTE'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    TUTTE
                  </button>
                  
                  {Object.entries(fasceFVM).map(([key, fascia]) => (
                    <button
                      key={key}
                      onClick={() => setFiltroFascia(key)}
                      className={`px-3 py-1 text-sm font-medium rounded text-white ${
                        filtroFascia === key
                          ? 'ring-2 ring-offset-1 ring-gray-800'
                          : 'hover:ring-1 hover:ring-gray-400'
                      } ${fascia.colore}`}
                      title={`${fascia.nome} (${fascia.sigla})`}
                    >
                      {fascia.nome}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtri Preferiti */}
              <div className="mt-3">
                <div className="text-xs font-medium text-gray-700 mb-2">Filtri Preferiti:</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFiltroPreferiti('TUTTI')}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      filtroPreferiti === 'TUTTI'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    TUTTI
                  </button>
                  
                  <button
                    onClick={() => {
                      if (filtroPreferiti === 'PREFERITI') {
                        setFiltroPreferiti('TUTTI');
                        setPreferitiListoneVisible(false);
                        setShowScrollToTop(false);
                      } else {
                        setFiltroPreferiti('PREFERITI');
                        setPreferitiListoneVisible(true);
                        setShowScrollToTop(true);
                      }
                    }}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      filtroPreferiti === 'PREFERITI'
                        ? 'bg-pink-600 text-white'
                        : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                    }`}
                    title="Solo giocatori preferiti"
                  >
                    ❤️ PREFERITI ({giocatoriPreferiti.length}) {filtroPreferiti === 'PREFERITI' ? '▼' : '▶'}
                  </button>
                  
                  <button
                    onClick={() => setFiltroPreferiti('NON_PREFERITI')}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      filtroPreferiti === 'NON_PREFERITI'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title="Solo giocatori non preferiti"
                  >
                    NON PREFERITI
                  </button>
                </div>
              </div>

              {/* Legenda Fasce */}
              <div className="mt-3">
                <div className="text-xs font-medium text-gray-700 mb-2">Legenda Fasce:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(fasceFVM).map(([key, fascia]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded ${fascia.colore}`}></div>
                      <span className="font-medium">{fascia.sigla} = {fascia.nome}</span>
                    </div>
                  ))}
                </div>

              </div>
            </div>

            <div className="flex space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cerca giocatore..."
                  value={ricerca}
                  onChange={(e) => setRicerca(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={ordinamento}
                onChange={(e) => setOrdinamento(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="FVM">FVM ↓</option>
                <option value="FASCIA">Fascia ↓</option>
                <option value="NOME">Nome</option>
                <option value="SQUADRA">Squadra</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Contenuto condizionale in base alla tab attiva */}
            {tabAttiva === 'listone' ? (
              <>
                {/* Sezione PREFERITI in evidenza */}
                {giocatoriPreferitiCompleti.length > 0 && preferitiListoneVisible && (
                  <div className="bg-gradient-to-r from-pink-500 to-red-500 text-white p-4 border-b-4 border-pink-600">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold flex items-center">
                        <span className="mr-2">❤️</span>
                        I TUOI PREFERITI ({giocatoriPreferitiCompleti.length})
                      </h3>
                      <button
                        onClick={() => setSidebarPreferitiVisible(true)}
                        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm transition-colors"
                      >
                        Gestisci →
                      </button>
                    </div>
                    
                    <div className="grid gap-2">
                      {giocatoriPreferitiCompleti
                        .sort((a, b) => {
                          // Prima giocatori con note, poi per FVM
                          const aNota = getNoteGiocatore(a);
                          const bNota = getNoteGiocatore(b);
                          if (aNota && !bNota) return -1;
                          if (!aNota && bNota) return 1;
                          return (b.FVM || 0) - (a.FVM || 0);
                        })
                        .slice(0, 5) // Mostra solo i primi 5
                        .map(giocatore => {
                          const nota = getNoteGiocatore(giocatore);
                          const inRosa = rosa.some(g => g.id === giocatore.id);
                          
                          return (
                            <div
                              key={giocatore.id}
                              className={`bg-white/10 backdrop-blur rounded-lg p-3 hover:bg-white/20 cursor-pointer transition-all ${
                                inRosa ? 'opacity-50 bg-green-400/20' : ''
                              }`}
                              onClick={() => focusGiocatore(giocatore)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center space-x-1">
                                    {getTuttiRuoli(giocatore.ruoloCompleto).map((ruoloSingolo, index) => {
                                      const ruoloInfo = RUOLI_MANTRA[ruoloSingolo];
                                      if (!ruoloInfo) return null;
                                      return (
                                        <span 
                                          key={index}
                                          className="px-2 py-1 text-xs font-bold bg-white text-gray-800 rounded shadow"
                                        >
                                          {ruoloInfo.sigla}
                                        </span>
                                      );
                                    })}
                                  </div>
                                  <div>
                                    <div className="font-semibold">{giocatore.nome}</div>
                                    <div className="text-sm opacity-90">{giocatore.squadra} • FVM: {giocatore.FVM || 'N/A'}</div>
                                    {nota && (
                                      <div className="text-sm bg-yellow-400 text-yellow-900 px-2 py-1 rounded mt-1 font-medium">
                                        📝 {nota}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="text-right">
                                  {inRosa ? (
                                    <span className="text-sm bg-green-400 text-green-900 px-2 py-1 rounded font-bold">
                                      IN ROSA
                                    </span>
                                  ) : (
                                    <div>
                                      <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                                        <div className="text-xs text-green-700 font-medium mb-1">Suggerito:</div>
                                        <div className="flex items-center justify-between">
                                          <input
                                            type="number"
                                            value={getPrezzoSuggerito(giocatore)}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              aggiornaPrezzosuggerito(giocatore, e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-16 text-lg font-bold text-center bg-white border border-green-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            min="1"
                                            max="999"
                                          />
                                          <span className="text-sm font-medium text-green-700">FM</span>
                                        </div>
                                        <div className="text-xs text-green-600 font-medium text-center mt-1">
                                          ({calcolaPercentuale(getPrezzoSuggerito(giocatore))}% budget)
                                        </div>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          aggiungiGiocatore(giocatore);
                                        }}
                                        className="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded transition-colors mt-1"
                                      >
                                        + ACQUISTA
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      
                      {giocatoriPreferitiCompleti.length > 5 && (
                        <div className="text-center py-2">
                          <button
                            onClick={() => setSidebarPreferitiVisible(true)}
                            className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors"
                          >
                            Vedi tutti i {giocatoriPreferitiCompleti.length} preferiti →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Lista principale */}
                <div className={giocatoriPreferitiCompleti.length > 0 ? 'pt-4' : ''}>
                  {listoneFiltered.length > 0 ? (
                    listoneFiltered.map(giocatore => {
                const ruolo = RUOLI_MANTRA[giocatore.ruolo];
                const inRosa = rosa.some(g => g.id === giocatore.id);
                const playerId = `${giocatore.nome}_${giocatore.squadra}`;
                const isFocused = focusedPlayerId === playerId;
                
                const isPreferito = isGiocatorePreferito(giocatore);
                const notaGiocatore = getNoteGiocatore(giocatore);
                
                return (
                  <div
                    key={giocatore.id}
                    id={`player-${playerId}`}
                    className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-all duration-300 ${
                      inRosa ? 'bg-green-50 border-l-4 border-green-400' : 
                      isPreferito ? 'bg-gradient-to-r from-pink-50 to-red-50 border-l-4 border-pink-400 shadow-sm' : ''
                    } ${
                      isFocused ? 'bg-yellow-200 ring-2 ring-yellow-400 ring-opacity-75 shadow-lg transform scale-[1.02]' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-wrap">
                      {/* Badge Ruoli - Compatti a sinistra */}
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {getTuttiRuoli(giocatore.ruoloCompleto).map((ruoloSingolo, index) => {
                          const ruoloInfo = RUOLI_MANTRA[ruoloSingolo];
                          if (!ruoloInfo) return null;
                          return (
                            <span 
                              key={index}
                              className={`px-2 py-1 text-xs font-bold text-white rounded-md shadow-sm ${ruoloInfo.colore}`}
                            >
                              {ruoloInfo.sigla}
                            </span>
                          );
                        })}
                      </div>
                      
                      {/* Nome e squadra - spazio centrale */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <div className={`font-semibold text-base truncate ${
                            isPreferito ? 'text-pink-900' : 'text-gray-900'
                          }`}>
                            {giocatore.nome}
                          </div>
                          {isPreferito && (
                            <span className="text-pink-500 text-sm animate-pulse" title="Preferito">❤️</span>
                          )}
                          {notaGiocatore && (
                            <span className="bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded text-xs font-bold" title={`Note: ${notaGiocatore}`}>
                              📝 NOTA
                            </span>
                          )}
                        </div>
                        <div className={`text-sm font-medium ${
                          isPreferito ? 'text-pink-700' : 'text-gray-600'
                        }`}>
                          {giocatore.squadra}
                        </div>
                      </div>
                      
                      {/* Cuore e Fascia a destra del nome */}
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {/* Badge Preferito */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGiocatorePreferito(giocatore);
                          }}
                          className={`p-1 rounded-full transition-all hover:scale-110 ${
                            isGiocatorePreferito(giocatore)
                              ? 'text-pink-500 hover:text-pink-600 scale-110 opacity-100'
                              : 'text-gray-400 hover:text-pink-400 opacity-40 hover:opacity-70'
                          }`}
                          title={isGiocatorePreferito(giocatore) ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                        >
                          <span className={`transition-all duration-300 ${
                            isGiocatorePreferito(giocatore) ? 'text-lg' : 'text-sm'
                          }`}>❤️</span>
                        </button>
                        
                        {/* Badge Fascia */}
                        <div className="relative">
                          {(() => {
                            const fascia = getFasciaGiocatore(giocatore.id, giocatore.fvm, fasceManuali, fasceFVM, giocatore.ruolo, listone);
                            const isDropdownOpen = dropdownFasciaAperto[giocatore.id];
                            
                            return (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDropdownFasciaAperto(prev => ({
                                      ...prev,
                                      [giocatore.id]: !prev[giocatore.id]
                                    }));
                                  }}
                                  className={`px-3 py-1.5 text-sm font-bold text-white rounded hover:opacity-80 transition-opacity shadow-sm ${fascia.colore}`}
                                  title={`Fascia: ${fascia.nome} (clicca per cambiare)`}
                                >
                                  {fascia.sigla}
                                </button>
                                
                                {isDropdownOpen && (
                                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-32">
                                    {Object.entries(fasceFVM).map(([key, fasciaOpt]) => (
                                      <button
                                        key={key}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFasceManuali(prev => ({
                                            ...prev,
                                            [giocatore.id]: key
                                          }));
                                          setDropdownFasciaAperto(prev => ({
                                            ...prev,
                                            [giocatore.id]: false
                                          }));
                                        }}
                                        className={`w-full text-left px-2 py-1 text-xs hover:bg-gray-100 flex items-center space-x-2 ${
                                          fascia.key === key ? 'bg-gray-100' : ''
                                        }`}
                                      >
                                        <div className={`w-3 h-3 rounded ${fasciaOpt.colore}`}></div>
                                        <span>{fasciaOpt.nome}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      {/* Sezione prezzi e statistiche - Più spazio e visibilità */}
                      <div className="flex flex-col items-end space-y-2 min-w-[180px] sm:min-w-[180px] min-w-0 w-full sm:w-auto">
                        {/* Statistiche compatte */}
                        <div className="bg-gray-50 px-2 py-1 rounded text-xs">
                          <span className="text-gray-600">FVM: <span className="font-bold text-blue-600">{giocatore.fvm || 0}</span></span>
                          <span className="ml-3 text-gray-600">QA: <span className="font-bold text-orange-600">{giocatore.qa || 0}</span></span>
                        </div>
                        {inRosa ? (
                          <div className="flex flex-col items-end space-y-1">
                            <div className="text-xl font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-md">
                              {prezziPagati[giocatore.id] || getPrezzoSuggerito(giocatore)} FM
                            </div>
                            <div className="text-xs text-blue-700 font-medium">
                              ({calcolaPercentuale(prezziPagati[giocatore.id] || getPrezzoSuggerito(giocatore))}% budget)
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end space-y-2 w-full">
                            {/* Prezzo Suggerito - Più visibile */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-2 w-full">
                              <div className="text-xs text-green-700 font-medium mb-1">Suggerito:</div>
                              <div className="flex items-center justify-between">
                                <input
                                  type="number"
                                  value={getPrezzoSuggerito(giocatore)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    aggiornaPrezzosuggerito(giocatore, e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-20 text-lg font-bold text-center bg-white border border-green-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                  min="1"
                                  max="999"
                                />
                                <span className="text-sm font-medium text-green-700">FM</span>
                              </div>
                              <div className="text-xs text-green-600 font-medium text-center mt-1">
                                ({calcolaPercentuale(getPrezzoSuggerito(giocatore))}% budget)
                              </div>
                            </div>
                            <input
                              type="number"
                              placeholder={getPrezzoSuggerito(giocatore)}
                              value={prezziPagati[giocatore.id] || ''}
                              onChange={(e) => {
                                const valore = parseInt(e.target.value) || '';
                                if (valore > 0) {
                                  aggiornaPrezzoGiocatore(giocatore, valore);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-24 px-3 py-2 text-base border-2 border-blue-300 rounded-md text-center font-bold focus:border-blue-500 focus:outline-none bg-white"
                            />
                          </div>
                        )}
                        {/* Bottoni Azione */}
                        {tabAttiva === 'scartati' ? (
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                ripristinaGiocatore(giocatore);
                              }}
                              className="px-3 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors shadow-sm font-medium"
                              title="Ripristina questo giocatore nel listone"
                            >
                              ↩️ Ripristina
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPlayerStats(giocatore);
                              }}
                              className="px-3 py-2 text-sm text-white rounded-md transition-colors shadow-sm font-medium bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                              title="📊 Visualizza statistiche giocatore"
                            >
📊 Stats
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col space-y-1">
                            <div className="flex space-x-1">
                              {!inRosa ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      aggiungiGiocatore(giocatore);
                                    }}
                                    className="px-2 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors shadow-sm font-medium"
                                    title="Acquista questo giocatore per la tua rosa"
                                  >
                                    💰 Acquista
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      scartaGiocatore(giocatore);
                                    }}
                                    className="px-2 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors shadow-sm font-medium"
                                    title="Scarta questo giocatore (acquistato da altri)"
                                  >
                                    🗑️ Scarta
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    rimuoviGiocatore(giocatore);
                                  }}
                                  className="px-2 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors shadow-sm font-medium"
                                  title="Rimuovi questo giocatore dalla tua rosa"
                                >
                                  ❌ Rimuovi
                                </button>
                              )}
                            </div>
                            {/* Bottone Statistiche */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPlayerStats(giocatore);
                              }}
                              className="px-2 py-1.5 text-xs text-white rounded transition-colors shadow-sm font-medium w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                              title="📊 Visualizza statistiche giocatore"
                            >
📊 Stats
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Campo Note - Nuova riga */}
                    <div className={`mt-3 pt-3 border-t ${
                      isPreferito ? 'border-pink-200' : 'border-gray-100'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <span className={`text-xs font-medium ${
                            isPreferito ? 'text-pink-600' : 'text-gray-500'
                          } min-w-[35px]`}>
                            Note:
                          </span>
                          {notaGiocatore && (
                            <span className="text-yellow-600 text-sm" title="Ha note">📝</span>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder={isPreferito ? "Note per l'asta..." : "Aggiungi note personali..."}
                          value={notaGiocatore}
                          onChange={(e) => {
                            aggiornaNoteGiocatore(giocatore, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`flex-1 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 ${
                            isPreferito 
                              ? 'border-pink-300 focus:ring-pink-400 focus:border-pink-400 bg-pink-50' 
                              : 'border-gray-200 focus:ring-blue-400 focus:border-blue-400'
                          }`}
                        />
                      </div>
                      {/* Mostra note esistenti in modo prominente per preferiti */}
                      {isPreferito && notaGiocatore && (
                        <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs">
                          <div className="flex items-start space-x-1">
                            <span className="text-yellow-600">🎯</span>
                            <span className="font-medium text-yellow-800">{notaGiocatore}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Upload className="w-16 h-16 mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Nessun giocatore nel listone</h3>
                  <p className="text-sm text-center px-4">
                    {listone.length === 0 
                      ? "Carica il file Excel per importare i giocatori" 
                      : "Nessun giocatore corrisponde ai filtri selezionati"
                    }
                  </p>
                </div>
              )}
                </div>
              </>
            ) : (
              // Tab SCARTATI
              giocatoriScartatiFiltered.length > 0 ? (
                giocatoriScartatiFiltered.map(giocatore => {
                  const ruolo = RUOLI_MANTRA[giocatore.ruolo];
                  const inRosa = rosa.some(g => g.id === giocatore.id);
                  
                  return (
                    <div
                      key={giocatore.id}
                      className="p-4 border-b border-gray-100 bg-red-50 hover:bg-red-100 cursor-pointer"
                      onClick={() => ripristinaGiocatore(giocatore)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          {/* Badge Ruoli scartati - Più grandi ma opachi */}
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            {getTuttiRuoli(giocatore.ruoloCompleto).map((ruoloSingolo, index) => {
                              const ruoloInfo = RUOLI_MANTRA[ruoloSingolo];
                              if (!ruoloInfo) return null;
                              return (
                                <span 
                                  key={index}
                                  className={`px-2.5 py-1 text-sm font-bold text-white rounded-md shadow-sm opacity-75 ${ruoloInfo.colore}`}
                                >
                                  {ruoloInfo.sigla}
                                </span>
                              );
                            })}
                          </div>
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-700 text-base">{giocatore.nome}</div>
                              <div className="text-sm text-gray-600 font-medium">{giocatore.squadra}</div>
                            </div>
                            {/* Badge Preferito per scartati */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGiocatorePreferito(giocatore);
                              }}
                              className={`p-1.5 rounded-full transition-all hover:scale-110 ${
                                isGiocatorePreferito(giocatore)
                                  ? 'text-pink-500 hover:text-pink-600 scale-125 opacity-100 shadow-lg shadow-pink-500/50'
                                  : 'text-gray-400 hover:text-pink-400 opacity-25 hover:opacity-60'
                              }`}
                              title={isGiocatorePreferito(giocatore) ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                            >
                              <span className={`transition-all duration-300 ${
                                isGiocatorePreferito(giocatore) ? 'text-2xl animate-bounce' : 'text-lg'
                              }`}>❤️</span>
                            </button>
                            {/* Badge Fascia per scartati */}
                            <div className="relative">
                              {(() => {
                                const fascia = getFasciaGiocatore(giocatore.id, giocatore.fvm, fasceManuali, fasceFVM, giocatore.ruolo, listone);
                                return (
                                  <span
                                    className={`px-2 py-1 text-sm font-bold text-white rounded shadow-sm opacity-75 ${fascia.colore}`}
                                    title={`Fascia: ${fascia.nome}`}
                                  >
                                    {fascia.sigla}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end space-y-2 min-w-[120px]">
                          {/* Statistiche più grandi per scartati */}
                          <div className="bg-red-100 px-3 py-1.5 rounded-md opacity-75">
                            <div className="text-sm font-semibold text-gray-700">FVM: <span className="text-blue-600">{giocatore.fvm || 0}</span></div>
                            <div className="text-sm font-semibold text-gray-700">QA: <span className="text-orange-600">{giocatore.qa || 0}</span></div>
                          </div>
                          <div className="bg-red-50 border border-red-200 rounded-lg p-2 opacity-75 min-w-[120px]">
                            <div className="text-xs text-red-700 font-medium mb-1">Suggerito:</div>
                            <div className="flex items-center justify-between">
                              <input
                                type="number"
                                value={getPrezzoSuggerito(giocatore)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  aggiornaPrezzosuggerito(giocatore, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-16 text-sm font-bold text-center bg-white border border-red-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                                min="1"
                                max="999"
                              />
                              <span className="text-xs font-medium text-red-700">FM</span>
                            </div>
                            <div className="text-xs text-red-600 font-medium text-center mt-1">
                              ({calcolaPercentuale(getPrezzoSuggerito(giocatore))}% budget)
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              ripristinaGiocatore(giocatore);
                            }}
                            className="px-3 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors shadow-sm font-medium"
                            title="Ripristina questo giocatore nel listone"
                          >
                            ↩️ Ripristina
                          </button>
                        </div>
                      </div>
                      {/* Campo Note per scartati - Nuova riga */}
                      <div className="mt-3 pt-3 border-t border-red-200">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-medium text-gray-500 min-w-[35px]">Note:</span>
                          <input
                            type="text"
                            placeholder="Aggiungi note personali..."
                            value={getNoteGiocatore(giocatore)}
                            onChange={(e) => {
                              aggiornaNoteGiocatore(giocatore, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 px-2 py-1 text-xs border border-red-200 rounded focus:outline-none focus:ring-1 focus:ring-pink-400 focus:border-pink-400 opacity-75"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <div className="text-6xl mb-4">🗑️</div>
                  <h3 className="text-lg font-medium mb-2">Nessun giocatore scartato</h3>
                  <p className="text-sm text-center px-4">
                    Quando scarti dei giocatori dal listone, appariranno qui e potrai ripristinarli
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Divisore draggabile */}
        <div
          className={`${isMobile ? 'hidden' : 'w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors'}`}
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startWidth = larghezzaListone;
            
            const handleMouseMove = (e) => {
              const deltaX = e.clientX - startX;
              const newWidth = startWidth + (deltaX / window.innerWidth) * 100;
              setLarghezzaListone(Math.max(20, Math.min(70, newWidth))); // Min 20%, Max 70%
            };
            
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />
        
        {/* Sezione Rosa + Moduli + Suggerimenti (dinamica %) */}
        <div className="flex" style={{ width: isMobile ? '100%' : `${100 - larghezzaListone}%` }}>
          {/* Rosa */}
          <div className="flex flex-col bg-white border-r border-gray-200" style={{ width: isMobile ? '100%' : `${larghezzaRosa}%` }}>
            <div className="p-2 sm:p-4 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">ROSA ({rosa.length}/32)</h2>
              <div className="text-xs sm:text-sm text-gray-500 mt-1 hidden sm:block">{FORMULA_ROSA}</div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-xs sm:text-sm font-semibold text-blue-800 mb-2 sm:mb-3 flex items-center">
                  <span className="bg-blue-600 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs mr-1 sm:mr-2">FORMULA</span>
                  <span className="hidden sm:inline">Ruoli Richiesti per </span>{moduliTarget[0] || 'Modulo'}
                </h3>
                
                {draggedPlayer && (
                  <div className="bg-blue-100 border border-blue-300 rounded-lg p-2 mb-3 text-xs text-blue-800 flex items-center space-x-2">
                    <span>🎯</span>
                    <span>Trascina <strong>{draggedPlayer.nome}</strong> nella sezione del ruolo desiderato</span>
                  </div>
                )}
                
                <div className="space-y-2">
                  {Object.entries(rosaNecessaria.ruoli)
                    .sort(([ruoloA], [ruoloB]) => {
                      // Ordina per linea: Por, Difesa, Centro, Trequarti, Attacco  
                      const getOrdineLinea = (ruolo) => {
                        if (ruolo === 'Por') return 1;
                        const info = RUOLI_MANTRA[ruolo];
                        if (!info) return 999;
                        if (info.linea === 'difesa') return 2;
                        if (info.linea === 'centrocampo') return 3;
                        if (info.linea === 'trequarti') return 4;
                        if (info.linea === 'attacco') return 5;
                        return 6;
                      };
                      return getOrdineLinea(ruoloA) - getOrdineLinea(ruoloB);
                    })
                    .map(([ruolo, necessari]) => {
                      const attuali = conteggioRosa.ruoli[ruolo] || 0;
                      const ruoloInfo = RUOLI_MANTRA[ruolo];
                      const config = CONFIGURAZIONE_MODULI[moduliTarget[0]];
                      const slotModulo = config?.ruoli[ruolo] || 0;
                      
                      const isCompleto = attuali >= necessari;
                      const percentuale = Math.min((attuali / necessari) * 100, 100);
                      
                      return (
                        <div 
                          key={ruolo} 
                          className={`p-3 rounded-lg border-l-4 transition-all duration-200 ${
                            isCompleto ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'
                          } ${
                            dragOverRole === ruolo 
                              ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-300' 
                              : ''
                          }`}
                          onDragOver={(e) => handleRoleDragOver(e, ruolo)}
                          onDragEnter={(e) => handleRoleDragEnter(e, ruolo)}
                          onDragLeave={handleRoleDragLeave}
                          onDrop={(e) => handleRoleDrop(e, ruolo)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              {ruoloInfo && (
                                <span className={`px-2 py-1 text-sm font-bold text-white rounded-md ${ruoloInfo.colore}`}>
                                  {ruoloInfo.sigla}
                                </span>
                              )}
                              <div className="text-sm">
                                <div className="font-medium text-gray-800">
                                  {ruolo === 'Por' ? 'Portieri (fisso)' : `${slotModulo} slot × 2 + 1`}
                                </div>
                                {ruolo !== 'Por' && (
                                  <div className="text-xs text-gray-500">
                                    ({slotModulo} × 2 + 1 = {necessari})
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-lg font-bold ${isCompleto ? 'text-green-600' : 'text-red-600'}`}>
                                {attuali}/{necessari}
                              </span>
                              <div className="text-xs text-gray-500">
                                {Math.round(percentuale)}% completo
                              </div>
                            </div>
                          </div>
                          
                          {/* Barra di progresso */}
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                isCompleto ? 'bg-green-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(percentuale, 100)}%` }}
                            ></div>
                          </div>
                          
                          {attuali > necessari && (
                            <div className="mt-1 text-xs text-blue-600 font-medium">
                              +{attuali - necessari} extra (ottimo per rotazioni!)
                            </div>
                          )}
                          
                          {/* Giocatori per questo ruolo */}
                          <div className="mt-2">
                            <div className="flex flex-wrap gap-1">
                              {getGiocatoriPerRuolo()[ruolo]?.filter((giocatore, index, array) => {
                                // Evita duplicati se giocatore non ha assegnazione specifica
                                const ruoloAssegnato = getRuoloAssegnato(giocatore);
                                if (!ruoloAssegnato) {
                                  // Se il giocatore non ha assegnazione, mostralo solo nel primo ruolo che può ricoprire
                                  const ruoliGiocatore = getTuttiRuoli(giocatore.ruoloCompleto);
                                  return ruoliGiocatore[0] === ruolo;
                                }
                                return ruoloAssegnato === ruolo;
                              }).map(giocatore => {
                                const ruoloAssegnato = getRuoloAssegnato(giocatore);
                                const ruoliDisponibili = getTuttiRuoli(giocatore.ruoloCompleto);
                                const prezzo = prezziPagati[giocatore.id] || getPrezzoSuggerito(giocatore);
                                
                                return (
                                  <div
                                    key={`${giocatore.id}-${ruolo}`}
                                    draggable={ruoliDisponibili.length > 1}
                                    onDragStart={(e) => handlePlayerDragStart(e, giocatore)}
                                    onDragEnd={handlePlayerDragEnd}
                                    className={`bg-white border border-gray-300 rounded p-1.5 text-xs transition-all duration-200 ${
                                      ruoliDisponibili.length > 1 
                                        ? 'cursor-move hover:shadow-md' 
                                        : 'cursor-default'
                                    } ${
                                      draggedPlayer?.id === giocatore.id 
                                        ? 'opacity-50 transform rotate-1' 
                                        : 'hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-1">
                                      <div className={`w-3 h-3 rounded-full ${RUOLI_MANTRA[ruolo]?.colore || 'bg-gray-500'} flex-shrink-0`}></div>
                                      <span className="font-medium text-gray-900 truncate max-w-16">{giocatore.nome}</span>
                                      <span className="text-gray-500">{prezzo}FM</span>
                                      {ruoliDisponibili.length > 1 && (
                                        <span className="text-gray-400 text-xs">🔄</span>
                                      )}
                                    </div>
                                    {ruoloAssegnato && (
                                      <div className="text-xs text-blue-600 mt-0.5 flex items-center">
                                        📌 Assegnato
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            rimuoviAssegnazioneRuolo(giocatore);
                                          }}
                                          className="ml-1 text-red-500 hover:text-red-700"
                                          title="Rimuovi assegnazione"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              }) || []}
                            </div>
                            
                            {/* Messaggio se nessun giocatore */}
                            {(!getGiocatoriPerRuolo()[ruolo] || getGiocatoriPerRuolo()[ruolo].length === 0) && (
                              <div className="text-xs text-gray-400 italic py-1">
                                Nessun giocatore per questo ruolo
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
                
                <div className="mt-3 sm:mt-4">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Giocatori in Rosa ({rosa.length}/32):</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2">
                    {rosa.length === 0 ? (
                      <div className="col-span-1 sm:col-span-2 text-center py-6 sm:py-8 text-gray-500">
                        <Users className="w-8 sm:w-12 h-8 sm:h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-xs sm:text-sm">Nessun giocatore acquistato</p>
                      </div>
                    ) : (
                      rosa
                        .sort((a, b) => {
                          // Ordina per linea (portiere, difesa, centrocampo, attacco) e poi per ruolo
                          const getOrdineLinea = (ruolo) => {
                            if (ruolo === 'Por') return 1;
                            if (['Dc', 'Dd', 'Ds', 'Ed', 'Es'].includes(ruolo)) return 2;
                            if (['M', 'C', 'T', 'Cc', 'W', 'E'].includes(ruolo)) return 3;
                            if (['A', 'Pc'].includes(ruolo)) return 4;
                            return 5;
                          };
                          
                          const lineaA = getOrdineLinea(a.ruolo);
                          const lineaB = getOrdineLinea(b.ruolo);
                          
                          if (lineaA !== lineaB) return lineaA - lineaB;
                          
                          // Se stessa linea, ordina per ruolo alfabeticamente
                          return a.ruolo.localeCompare(b.ruolo);
                        })
                        .map(giocatore => {
                          const prezzo = prezziPagati[giocatore.id] || getPrezzoSuggerito(giocatore);
                          const percentuale = calcolaPercentuale(prezzo);
                          
                          return (
                            <div
                              key={giocatore.id}
                              className="bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2 hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => rimuoviGiocatore(giocatore)}
                              title="Clicca per rimuovere dalla rosa"
                            >
                              <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                                {getTuttiRuoli(giocatore.ruoloCompleto).slice(0, 2).map((ruoloSingolo, index) => {
                                  const ruoloInfo = RUOLI_MANTRA[ruoloSingolo];
                                  if (!ruoloInfo) return null;
                                  return (
                                    <span 
                                      key={index}
                                      className={`px-1 py-0.5 text-xs font-bold text-white rounded ${ruoloInfo.colore}`}
                                    >
                                      {ruoloInfo.sigla}
                                    </span>
                                  );
                                })}
                                {getTuttiRuoli(giocatore.ruoloCompleto).length > 2 && (
                                  <span className="text-xs text-gray-400">+{getTuttiRuoli(giocatore.ruoloCompleto).length - 2}</span>
                                )}
                              </div>
                              <div className="text-xs sm:text-sm font-medium text-gray-900 truncate mb-1">
                                {giocatore.nome}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs sm:text-sm font-bold text-blue-600">
                                  {prezzo} FM
                                </span>
                                <span className="text-xs text-gray-500">
                                  {percentuale}%
                                </span>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Divisore Rosa/Formazione */}
          <div 
            className={`${isMobile ? 'hidden' : 'w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors'}`}
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = larghezzaRosa;
              const containerWidth = (100 - larghezzaListone);
              
              const onMouseMove = (e) => {
                const deltaX = e.clientX - startX;
                const containerWidthPx = window.innerWidth * (100 - larghezzaListone) / 100;
                const deltaPercent = (deltaX / containerWidthPx) * 100;
                const newWidth = Math.min(Math.max(startWidth + deltaPercent, 25), 75); // Min 25%, Max 75%
                setLarghezzaRosa(newWidth);
              };
              
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
              };
              
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            }}
          />

          {/* Formazione + Suggerimenti */}
          <div className="flex-1 flex flex-col bg-white" style={{ height: isMobile ? 'auto' : 'calc(100vh - 200px)' }}>
            {/* Formazione (50%) */}
            <div className="h-[50%] flex flex-col border-b border-gray-200 min-h-0">
              <div className="p-2 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">FORMAZIONE</h2>
                  {moduliTarget.length > 1 && (
                    <select
                      value={moduliTarget[0]}
                      onChange={(e) => {
                        const newModulo = e.target.value;
                        setModuliTarget(prev => [newModulo, ...prev.filter(m => m !== newModulo)]);
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {moduliTarget.map(modulo => (
                        <option key={modulo} value={modulo}>
                          {modulo}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto min-h-0 flex justify-center items-start">
                {moduliTarget.length > 0 ? (
                  <TacticalFormation 
                    modulo={moduliTarget[0]}
                    configurazione={CONFIGURAZIONE_MODULI[moduliTarget[0]]}
                    giocatoriRosa={rosa}
                    ruoliMantra={RUOLI_MANTRA}
                  />
                ) : (
                  <div className="p-2 text-center text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Seleziona modulo target</p>
                  </div>
                )}
              </div>
            </div>

            {/* Suggerimenti Intelligenti (50%) */}
            <div className="h-[50%] flex flex-col min-h-0">
              <div className="p-3 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-900">SUGGERIMENTI INTELLIGENTI</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 min-h-0">
                <SuggerimentiIntelligenti
                  preferiti={giocatoriPreferitiCompleti}
                  rosaNecessaria={rosaNecessaria}
                  conteggioRosa={conteggioRosa}
                  rosa={rosa}
                  budget={budget}
                  noteGiocatori={noteGiocatori}
                  prezziPagati={prezziPagati}
                  getPrezzoSuggerito={getPrezzoSuggerito}
                  calcolaPercentuale={calcolaPercentuale}
                  onFocusGiocatore={focusGiocatore}
                  RUOLI_MANTRA={RUOLI_MANTRA}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottone Scroll to Top */}
      {showScrollToTop && (
        <button
          onClick={() => {
            const listoneContainer = document.querySelector('.flex-1.overflow-y-auto');
            if (listoneContainer) {
              listoneContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }
            setShowScrollToTop(false);
          }}
          className="fixed bottom-6 right-6 z-50 bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
          title="Torna in alto"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
      
      {/* Sidebar Preferiti */}
      <SidebarPreferiti
        preferiti={giocatoriPreferitiCompleti}
        noteGiocatori={noteGiocatori}
        onTogglePreferito={toggleGiocatorePreferito}
        onAggiornaNote={aggiornaNoteGiocatore}
        onFocusGiocatore={focusGiocatore}
        isVisible={sidebarPreferitiVisible}
        onToggleVisibility={() => setSidebarPreferitiVisible(!sidebarPreferitiVisible)}
      />
      
      {/* Modal Statistiche Standard */}
      <PlayerStatsModal 
        isOpen={statsModalOpen}
        onClose={closePlayerStats}
        giocatore={selectedPlayerForStats}
      />
      
    </div>
  );
}

export default App;