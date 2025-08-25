import React, { useState, useEffect, useMemo } from 'react';
import { Search, Upload, Download, Filter, Users, Target } from 'lucide-react';
import * as XLSX from 'xlsx';

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
const getFasciaGiocatore = (giocatoreId, fvm, fasceManuali, fasceFVM) => {
  // Se c'è un'assegnazione manuale, usala
  if (fasceManuali[giocatoreId]) {
    const fasciaKey = fasceManuali[giocatoreId];
    return { key: fasciaKey, ...fasceFVM[fasciaKey] };
  }
  
  // Altrimenti usa l'assegnazione automatica basata su FVM
  if (fvm >= 300) return { key: 'supertop', ...fasceFVM.supertop };
  if (fvm >= 200) return { key: 'top', ...fasceFVM.top };
  if (fvm >= 100) return { key: 'buoni', ...fasceFVM.buoni };
  if (fvm >= 50) return { key: 'scommesse', ...fasceFVM.scommesse };
  return { key: 'daEvitare', ...fasceFVM.daEvitare };
};

// Formula: (Ruoli necessari × 2) + 1
const FORMULA_ROSA = "Per ogni ruolo nel modulo: (slot × 2) + 1 giocatore";

// Moduli target selezionabili dall'utente - TUTTI i moduli MANTRA
const MODULI_TARGET_DEFAULT = [
  '3-4-3', '3-4-1-2', '3-4-2-1', '3-5-2', '3-5-1-1',
  '4-3-3', '4-3-1-2', '4-4-2', '4-1-4-1', '4-4-1-1', '4-2-3-1'
];

// Configurazione moduli CORRETTA basata sui diagrammi MANTRA 2025/2026
const CONFIGURAZIONE_MODULI = {
  '3-4-3': {
    ruoli: { Por: 1, Dc: 2, B: 1, E: 2, M: 1, C: 1, W: 2, A: 2, Pc: 1 },
    linee: { portiere: 1, difesa: 3, centrocampo: 4, trequarti: 0, attacco: 3 }
  },
  '3-4-1-2': {
    ruoli: { Por: 1, Dc: 2, B: 1, E: 2, M: 1, C: 1, T: 1, A: 1, Pc: 1 },
    linee: { portiere: 1, difesa: 3, centrocampo: 4, trequarti: 1, attacco: 2 }
  },
  '3-4-2-1': {
    ruoli: { Por: 1, Dc: 2, B: 1, E: 2, M: 2, C: 1, W: 1, T: 1, Pc: 1 },
    linee: { portiere: 1, difesa: 3, centrocampo: 4, trequarti: 2, attacco: 1 }
  },
  '3-5-2': {
    ruoli: { Por: 1, Dc: 2, B: 1, E: 2, M: 2, C: 1, A: 1, Pc: 1 },
    linee: { portiere: 1, difesa: 3, centrocampo: 5, trequarti: 0, attacco: 2 }
  },
  '3-5-1-1': {
    ruoli: { Por: 1, Dc: 2, B: 1, E: 2, M: 2, C: 1, T: 1, A: 1 },
    linee: { portiere: 1, difesa: 3, centrocampo: 5, trequarti: 1, attacco: 1 }
  },
  '4-3-3': {
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 2, C: 1, W: 2, A: 2, Pc: 1 },
    linee: { portiere: 1, difesa: 4, centrocampo: 3, trequarti: 0, attacco: 3 }
  },
  '4-3-1-2': {
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 2, C: 1, T: 1, A: 1, Pc: 1 },
    linee: { portiere: 1, difesa: 4, centrocampo: 3, trequarti: 1, attacco: 2 }
  },
  '4-4-2': {
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 2, C: 2, E: 2, A: 1, Pc: 1 },
    linee: { portiere: 1, difesa: 4, centrocampo: 4, trequarti: 0, attacco: 2 }
  },
  '4-1-4-1': {
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 1, C: 1, T: 2, E: 2, W: 1, A: 1 },
    linee: { portiere: 1, difesa: 4, centrocampo: 1, trequarti: 4, attacco: 1 }
  },
  '4-4-1-1': {
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 2, C: 2, E: 2, T: 1, A: 1 },
    linee: { portiere: 1, difesa: 4, centrocampo: 4, trequarti: 1, attacco: 1 }
  },
  '4-2-3-1': {
    ruoli: { Por: 1, Dd: 1, Dc: 2, Ds: 1, M: 2, W: 2, T: 1, A: 1, Pc: 1 },
    linee: { portiere: 1, difesa: 4, centrocampo: 2, trequarti: 3, attacco: 1 }
  }
};

// Funzioni per persistenza localStorage
const STORAGE_KEYS = {
  BUDGET: 'mantra-asta-budget',
  MODULI_TARGET: 'mantra-asta-moduli-target', 
  ROSA: 'mantra-asta-rosa',
  PREZZI_PAGATI: 'mantra-asta-prezzi-pagati',
  FASCE_MANUALI: 'mantra-asta-fasce-manuali',
  LARGHEZZA_LISTONE: 'mantra-asta-larghezza-listone',
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
  const [prezziPagati, setPrezziPagati] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.PREZZI_PAGATI, {}));
  const [larghezzaListone, setLarghezzaListone] = useState(() => caricaDaLocalStorage(STORAGE_KEYS.LARGHEZZA_LISTONE, 40));
  
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
    salvaInLocalStorage(STORAGE_KEYS.FASCE_MANUALI, fasceManuali);
  }, [fasceManuali]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.LARGHEZZA_LISTONE, larghezzaListone);
  }, [larghezzaListone]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.GIOCATORI_SCARTATI, giocatoriScartati);
  }, [giocatoriScartati]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.GIOCATORI_PREFERITI, giocatoriPreferiti);
  }, [giocatoriPreferiti]);

  useEffect(() => {
    salvaInLocalStorage(STORAGE_KEYS.NOTE_GIOCATORI, noteGiocatori);
  }, [noteGiocatori]);

  // Funzioni per gestione dati
  const esportaDatiAsta = () => {
    const datiAsta = {
      budget,
      moduliTarget,
      rosa,
      prezziPagati,
      fasceManuali,
      larghezzaListone,
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
        if (datiAsta.fasceManuali) setFasceManuali(datiAsta.fasceManuali);
        if (datiAsta.larghezzaListone !== undefined) setLarghezzaListone(datiAsta.larghezzaListone);
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
  
  // Calcolo dinamico rosa necessaria per ruoli specifici
  const rosaNecessaria = useMemo(() => {
    const requisitiRuoli = {};
    const requisitiLinee = {};
    const requisitiOffensivi = {}; // Requisiti minimi per ruoli offensivi
    
    moduliTarget.forEach(modulo => {
      const config = CONFIGURAZIONE_MODULI[modulo];
      
      // Calcola requisiti per ruoli specifici
      Object.entries(config.ruoli).forEach(([ruolo, slot]) => {
        if (!requisitiRuoli[ruolo]) requisitiRuoli[ruolo] = 0;
        const necessari = (slot * 2) + 1;
        requisitiRuoli[ruolo] = Math.max(requisitiRuoli[ruolo], necessari);
        
        // Se questo ruolo ha una versione più offensiva, calcola il minimo per quella
        const ruoloOffensivo = RUOLO_OFFENSIVO_MAP[ruolo];
        if (ruoloOffensivo) {
          if (!requisitiOffensivi[ruoloOffensivo]) requisitiOffensivi[ruoloOffensivo] = 0;
          requisitiOffensivi[ruoloOffensivo] = Math.max(requisitiOffensivi[ruoloOffensivo], necessari);
        }
      });
      
      // Mantieni anche i requisiti per linee (per la rosa generale)
      Object.entries(config.linee).forEach(([linea, slot]) => {
        if (!requisitiLinee[linea]) requisitiLinee[linea] = 0;
        const necessari = (slot * 2) + 1;
        requisitiLinee[linea] = Math.max(requisitiLinee[linea], necessari);
      });
    });
    
    return { ruoli: requisitiRuoli, linee: requisitiLinee, offensivi: requisitiOffensivi };
  }, [moduliTarget]);

  // Conteggio giocatori per ruolo specifico e linea nella rosa attuale
  const conteggioRosa = useMemo(() => {
    const conteggioRuoli = {};
    const conteggioLinee = {};
    
    rosa.forEach(giocatore => {
      const ruolo = RUOLI_MANTRA[giocatore.ruolo];
      if (ruolo) {
        // Conteggio per ruolo specifico
        conteggioRuoli[giocatore.ruolo] = (conteggioRuoli[giocatore.ruolo] || 0) + 1;
        
        // Conteggio per linea
        const linea = ruolo.linea;
        conteggioLinee[linea] = (conteggioLinee[linea] || 0) + 1;
      }
    });
    
    return { ruoli: conteggioRuoli, linee: conteggioLinee };
  }, [rosa]);

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
      const fasciaGiocatore = getFasciaGiocatore(giocatore.id, giocatore.fvm, fasceManuali, fasceFVM);
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
          // Ordina per fascia (automatica + manuale) (Supertop → Da evitare)
          const fasciaOrder = ['supertop', 'top', 'buoni', 'scommesse', 'daEvitare'];
          const fasciaA = getFasciaGiocatore(a.id, a.fvm, fasceManuali, fasceFVM).key;
          const fasciaB = getFasciaGiocatore(b.id, b.fvm, fasceManuali, fasceFVM).key;
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
      const prezzoPagato = prezziPagati[giocatore.id] || giocatore.prezzoSuggerito || 1;
      setRosa([...rosa, giocatore]);
      setBudget(prev => prev - prezzoPagato);
    }
  };

  // Rimuovi giocatore dalla rosa
  const rimuoviGiocatore = (giocatore) => {
    const prezzoPagato = prezziPagati[giocatore.id] || giocatore.prezzoSuggerito || 1;
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
    const vecchioPrezzo = prezziPagati[giocatore.id] || giocatore.prezzoSuggerito || 1;
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
      const budgetPerGiocatore = Math.floor(budgetRimanente / Math.max(1, (25 - giocatoriRosa)));
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
    if (giocatoriRosa >= 10) {
      const budgetMedio = budgetRimanente / Math.max(1, (25 - giocatoriRosa));
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
    if (giocatoriRosa >= 20) {
      suggerimentiList.push({
        tipo: 'finale',
        messaggio: `🏁 Quasi finito! Completa con gli ultimi ${25 - giocatoriRosa} giocatori più convenienti`,
        priorita: 'bassa'
      });
    }

    return suggerimentiList.slice(0, 4); // Massimo 4 suggerimenti
  }, [rosaNecessaria, conteggioRosa, rosa, budget]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-500">BUDGET:</span>
              <span className={`text-lg font-bold ${budget < 50 ? 'text-red-600' : 'text-green-600'}`}>
                {budget}/{budgetMax}
              </span>
            </div>
          </div>
          
          {/* Controlli Persistenza */}
          <div className="flex items-center space-x-2">
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

      <div className="flex flex-1">
        {/* Sezione Listone/Scartati (dinamica %) */}
        <div className="flex flex-col bg-white border-r border-gray-200" style={{ width: `${larghezzaListone}%` }}>
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
                    onClick={() => setFiltroPreferiti('PREFERITI')}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      filtroPreferiti === 'PREFERITI'
                        ? 'bg-pink-600 text-white'
                        : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                    }`}
                    title="Solo giocatori preferiti"
                  >
                    ❤️ PREFERITI ({giocatoriPreferiti.length})
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
                <div className="text-xs text-gray-500 mt-2">
                  🔄 <strong>Auto</strong>: FVM ≥300→S, ≥200→T, ≥100→B, ≥50→C, &lt;50→D<br/>
                  ✏️ <strong>Manuale</strong>: Clicca sui badge colorati per modificare
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
              listoneFiltered.length > 0 ? (
                listoneFiltered.map(giocatore => {
                const ruolo = RUOLI_MANTRA[giocatore.ruolo];
                const inRosa = rosa.some(g => g.id === giocatore.id);
                
                return (
                  <div
                    key={giocatore.id}
                    className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                      inRosa ? 'bg-green-50' : ''
                    }`}
                    onClick={() => inRosa ? rimuoviGiocatore(giocatore) : aggiungiGiocatore(giocatore)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        {/* Badge Ruoli - Più grandi e visibili */}
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          {getTuttiRuoli(giocatore.ruoloCompleto).map((ruoloSingolo, index) => {
                            const ruoloInfo = RUOLI_MANTRA[ruoloSingolo];
                            if (!ruoloInfo) return null;
                            return (
                              <span 
                                key={index}
                                className={`px-2.5 py-1 text-sm font-bold text-white rounded-md shadow-sm ${ruoloInfo.colore}`}
                              >
                                {ruoloInfo.sigla}
                              </span>
                            );
                          })}
                        </div>
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 text-base">{giocatore.nome}</div>
                            <div className="text-sm text-gray-600 font-medium">{giocatore.squadra}</div>
                          </div>
                          {/* Badge Preferito */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGiocatorePreferito(giocatore);
                            }}
                            className={`p-1.5 rounded-full transition-all hover:scale-110 ${
                              isGiocatorePreferito(giocatore)
                                ? 'text-pink-500 hover:text-pink-600 scale-110'
                                : 'text-gray-300 hover:text-pink-400'
                            }`}
                            title={isGiocatorePreferito(giocatore) ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                          >
                            <span className="text-lg">❤️</span>
                          </button>
                          {/* Badge Fascia cliccabile accanto al nome */}
                          <div className="relative">
                            {(() => {
                              const fascia = getFasciaGiocatore(giocatore.id, giocatore.fvm, fasceManuali, fasceFVM);
                              const isDropdownOpen = dropdownFasciaAperto[giocatore.id];
                              
                              return (
                                <>
                                  {/* Badge cliccabile */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDropdownFasciaAperto(prev => ({
                                        ...prev,
                                        [giocatore.id]: !prev[giocatore.id]
                                      }));
                                    }}
                                    className={`px-2 py-1 text-sm font-bold text-white rounded hover:opacity-80 transition-opacity shadow-sm ${fascia.colore}`}
                                    title={`Fascia: ${fascia.nome} (clicca per cambiare)`}
                                  >
                                    {fascia.sigla}
                                  </button>
                                  
                                  {/* Dropdown nascosto di default */}
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
                      </div>
                      <div className="text-right flex flex-col items-end space-y-2 min-w-[120px]">
                        {/* Statistiche più grandi e leggibili */}
                        <div className="bg-gray-50 px-3 py-1.5 rounded-md">
                          <div className="text-sm font-semibold text-gray-700">FVM: <span className="text-blue-600">{giocatore.fvm || 0}</span></div>
                          <div className="text-sm font-semibold text-gray-700">QA: <span className="text-orange-600">{giocatore.qa || 0}</span></div>
                        </div>
                        {inRosa ? (
                          <div className="text-xl font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-md">
                            {prezziPagati[giocatore.id] || giocatore.prezzoSuggerito || 1}
                          </div>
                        ) : (
                          <div className="flex flex-col items-end space-y-1">
                            <div className="text-sm text-green-600 font-semibold bg-green-50 px-2 py-1 rounded">
                              Suggerito: <span className="font-bold">{giocatore.prezzoSuggerito}</span>
                            </div>
                            <input
                              type="number"
                              placeholder={giocatore.prezzoSuggerito || 1}
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
                        {/* Bottone Scarta/Ripristina */}
                        {tabAttiva === 'scartati' ? (
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
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              scartaGiocatore(giocatore);
                            }}
                            className="px-3 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors shadow-sm font-medium"
                            title="Scarta questo giocatore (acquistato da altri)"
                          >
                            🗑️ Scarta
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Campo Note - Nuova riga */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
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
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                      </div>
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
              )
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
                              className={`p-1.5 rounded-full transition-all hover:scale-110 opacity-75 ${
                                isGiocatorePreferito(giocatore)
                                  ? 'text-pink-500 hover:text-pink-600 scale-110'
                                  : 'text-gray-300 hover:text-pink-400'
                              }`}
                              title={isGiocatorePreferito(giocatore) ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                            >
                              <span className="text-lg">❤️</span>
                            </button>
                            {/* Badge Fascia per scartati */}
                            <div className="relative">
                              {(() => {
                                const fascia = getFasciaGiocatore(giocatore.id, giocatore.fvm, fasceManuali, fasceFVM);
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
                          <div className="text-sm text-gray-600 font-semibold bg-red-100 px-2 py-1 rounded opacity-75">
                            Suggerito: <span className="font-bold">{giocatore.prezzoSuggerito}</span>
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
          className="w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors"
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
        <div className="flex" style={{ width: `${100 - larghezzaListone}%` }}>
          {/* Rosa (33%) */}
          <div className="w-1/3 flex flex-col bg-white border-r border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">ROSA ({rosa.length})</h2>
              <div className="text-sm text-gray-500 mt-1">{FORMULA_ROSA}</div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {Object.entries(rosaNecessaria.linee).map(([linea, necessari]) => {
                const attuali = conteggioRosa.linee[linea] || 0;
                const percentuale = Math.min((attuali / necessari) * 100, 100);
                
                return (
                  <div key={linea} className="p-3 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 capitalize">{linea}</span>
                      <span className={`text-sm font-bold ${attuali >= necessari ? 'text-green-600' : 'text-red-600'}`}>
                        {attuali}/{necessari}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          attuali >= necessari ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${percentuale}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}

              <div className="p-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Ruoli Specifici Richiesti:</h3>
                <div className="grid grid-cols-2 gap-1 mb-4">
                  {Object.entries(rosaNecessaria.ruoli).map(([ruolo, necessari]) => {
                    const attuali = conteggioRosa.ruoli[ruolo] || 0;
                    const ruoloInfo = RUOLI_MANTRA[ruolo];
                    
                    return (
                      <div key={ruolo} className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1">
                          {ruoloInfo && (
                            <span className={`px-1 py-0.5 text-xs font-bold text-white rounded ${ruoloInfo.colore}`}>
                              {ruoloInfo.sigla}
                            </span>
                          )}
                        </div>
                        <span className={`font-bold ${attuali >= necessari ? 'text-green-600' : 'text-red-600'}`}>
                          {attuali}/{necessari}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {Object.keys(rosaNecessaria.offensivi).length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-purple-700 mb-2">Requisiti Minimi Offensivi:</h3>
                    <div className="grid grid-cols-1 gap-1 mb-4">
                      {Object.entries(rosaNecessaria.offensivi).map(([ruolo, necessari]) => {
                        const attuali = conteggioRosa.ruoli[ruolo] || 0;
                        const ruoloInfo = RUOLI_MANTRA[ruolo];
                        const ruoloDifensivo = Object.keys(RUOLO_OFFENSIVO_MAP).find(k => RUOLO_OFFENSIVO_MAP[k] === ruolo);
                        
                        return (
                          <div key={ruolo} className="bg-purple-50 p-2 rounded text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1">
                                {ruoloInfo && (
                                  <span className={`px-1 py-0.5 text-xs font-bold text-white rounded ${ruoloInfo.colore}`}>
                                    {ruoloInfo.sigla}
                                  </span>
                                )}
                                <span className="text-purple-700 font-medium">almeno:</span>
                              </div>
                              <span className={`font-bold ${attuali >= necessari ? 'text-green-600' : 'text-purple-600'}`}>
                                {attuali}/{necessari}
                              </span>
                            </div>
                            <div className="text-purple-600 text-xs mt-1">
                              (da {RUOLI_MANTRA[ruoloDifensivo]?.sigla} intercambiabili)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                
                
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Giocatori in Rosa:</h3>
                {rosa.map(giocatore => {
                  const ruolo = RUOLI_MANTRA[giocatore.ruolo];
                  return (
                    <div
                      key={giocatore.id}
                      className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => rimuoviGiocatore(giocatore)}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          {getTuttiRuoli(giocatore.ruoloCompleto).map((ruoloSingolo, index) => {
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
                        </div>
                        <span className="text-sm text-gray-900">{giocatore.nome}</span>
                      </div>
                      <div className="text-sm font-bold text-blue-600">
                        {prezziPagati[giocatore.id] || giocatore.prezzoSuggerito || 1}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Moduli (33%) */}
          <div className="w-1/3 flex flex-col bg-white border-r border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">VERIFICA MODULI</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {verificaModuli().map(({ modulo, verificato, config }) => (
                <div key={modulo} className="mb-4 p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">{modulo}</h3>
                    <span className={`px-2 py-1 text-xs font-bold rounded ${
                      verificato ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {verificato ? '✓ OK' : '✗ KO'}
                    </span>
                  </div>
                  
                  {Object.entries(config.ruoli).map(([ruolo, slot]) => {
                    if (slot === 0) return null;
                    const disponibili = conteggioRosa.ruoli[ruolo] || 0;
                    const necessariCalcolati = (slot * 2) + 1; // Applica la formula
                    const ok = disponibili >= necessariCalcolati;
                    const ruoloInfo = RUOLI_MANTRA[ruolo];
                    
                    const righe = [
                      <div key={ruolo} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          {ruoloInfo && (
                            <span className={`px-1 py-0.5 text-xs font-bold text-white rounded ${ruoloInfo.colore}`}>
                              {ruoloInfo.sigla}
                            </span>
                          )}
                          <span className="text-gray-600">{ruolo}:</span>
                        </div>
                        <span className={ok ? 'text-green-600' : 'text-red-600'}>
                          {disponibili}/{necessariCalcolati}
                        </span>
                      </div>
                    ];
                    
                    // Aggiungi ruolo offensivo intercambiabile se esiste
                    const ruoloOffensivo = RUOLO_OFFENSIVO_MAP[ruolo];
                    if (ruoloOffensivo) {
                      const disponibiliOffensivi = conteggioRosa.ruoli[ruoloOffensivo] || 0;
                      const ruoloOffensivoInfo = RUOLI_MANTRA[ruoloOffensivo];
                      const okOffensivo = disponibiliOffensivi >= necessariCalcolati;
                      
                      righe.push(
                        <div key={ruoloOffensivo} className="flex items-center justify-between text-sm bg-purple-50 px-2 py-1 rounded ml-4">
                          <div className="flex items-center space-x-2">
                            {ruoloOffensivoInfo && (
                              <span className={`px-1 py-0.5 text-xs font-bold text-white rounded ${ruoloOffensivoInfo.colore}`}>
                                {ruoloOffensivoInfo.sigla}
                              </span>
                            )}
                            <span className="text-purple-600 text-xs">({ruoloOffensivo} intercamb.):</span>
                          </div>
                          <span className={okOffensivo ? 'text-green-600' : 'text-purple-600'}>
                            {disponibiliOffensivi}/{necessariCalcolati}
                          </span>
                        </div>
                      );
                    }
                    
                    return righe;
                  }).flat()}
                </div>
              ))}
            </div>
          </div>

          {/* Suggerimenti (33%) */}
          <div className="w-1/3 flex flex-col bg-white">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">SUGGERIMENTI</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {suggerimenti.map((sug, index) => (
                <div key={index} className={`mb-3 p-3 rounded-lg border-l-4 ${
                  sug.priorita === 'alta' ? 'bg-red-50 border-red-400' :
                  sug.priorita === 'media' ? 'bg-yellow-50 border-yellow-400' :
                  'bg-blue-50 border-blue-400'
                }`}>
                  <div className="flex items-start">
                    <div className={`flex-shrink-0 w-2 h-2 mt-2 rounded-full ${
                      sug.priorita === 'alta' ? 'bg-red-400' :
                      sug.priorita === 'media' ? 'bg-yellow-400' :
                      'bg-blue-400'
                    }`}></div>
                    <p className="ml-3 text-sm text-gray-700">{sug.messaggio}</p>
                  </div>
                </div>
              ))}
              
              {suggerimenti.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Tutto ok! La tua rosa è bilanciata.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;