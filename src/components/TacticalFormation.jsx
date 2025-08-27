// Componente formazione tattica visuale con drag & drop
import React, { useState, useEffect } from 'react';
import { Move, RotateCcw, Users } from 'lucide-react';

const TacticalFormation = ({ 
  modulo, 
  configurazione, 
  giocatoriRosa, 
  ruoliMantra,
  onFormationChange = () => {} 
}) => {
  // Stato per le posizioni assegnate: { positionId: giocatore }
  const [formazioneAssegnata, setFormazioneAssegnata] = useState({});
  
  // Stato per drag and drop
  const [dragging, setDragging] = useState(null);
  
  // Carica formazione salvata dal localStorage
  useEffect(() => {
    const savedFormation = localStorage.getItem(`formation-${modulo}`);
    if (savedFormation) {
      try {
        const parsedFormation = JSON.parse(savedFormation);
        setFormazioneAssegnata(parsedFormation);
      } catch (error) {
        console.warn('Errore caricamento formazione salvata:', error);
      }
    }
  }, [modulo]);

  // Salva formazione quando cambia
  useEffect(() => {
    if (Object.keys(formazioneAssegnata).length > 0) {
      localStorage.setItem(`formation-${modulo}`, JSON.stringify(formazioneAssegnata));
      onFormationChange(formazioneAssegnata);
    }
  }, [formazioneAssegnata, modulo, onFormationChange]);

  // Ottieni posizioni dal modulo corrente con label e ruolo principale per display
  const getPositionsWithLabels = (configurazione) => {
    if (!configurazione.posizioni) {
      // Fallback: genera posizioni automatiche se non definite
      return [];
    }

    return configurazione.posizioni.map(position => ({
      ...position,
      // Ruolo principale per display (primo della lista)
      ruoloPrincipale: position.ruoli[0],
      // Label per display
      label: position.ruoli.length === 1 
        ? ruoliMantra[position.ruoli[0]]?.sigla || position.ruoli[0]
        : position.ruoli.map(r => ruoliMantra[r]?.sigla || r).join('/')
    }));
  };

  // Handle drag start
  const handleDragStart = (e, giocatore) => {
    setDragging(giocatore);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over position
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop su posizione
  const handleDrop = (e, positionId, positionRuoli) => {
    e.preventDefault();
    
    if (!dragging) return;

    // Verifica compatibilità ruolo - il giocatore deve avere almeno uno dei ruoli accettati
    const giocatoreRuoli = dragging.ruolo.split(';');
    const isCompatible = positionRuoli.some(ruolo => giocatoreRuoli.includes(ruolo));

    if (!isCompatible) {
      const ruoliAccettati = positionRuoli.join('/');
      alert(`❌ ${dragging.nome} (${dragging.ruolo}) non può giocare in posizione ${ruoliAccettati}`);
      setDragging(null);
      return;
    }

    // Rimuovi giocatore da altre posizioni se già assegnato
    const newFormazione = { ...formazioneAssegnata };
    Object.keys(newFormazione).forEach(key => {
      if (newFormazione[key]?.id === dragging.id) {
        delete newFormazione[key];
      }
    });

    // Assegna alla nuova posizione
    newFormazione[positionId] = dragging;
    
    setFormazioneAssegnata(newFormazione);
    setDragging(null);
  };

  // Rimuovi giocatore da posizione
  const rimuoviDaPosizione = (positionId) => {
    const newFormazione = { ...formazioneAssegnata };
    delete newFormazione[positionId];
    setFormazioneAssegnata(newFormazione);
  };

  // Reset formazione
  const resetFormazione = () => {
    setFormazioneAssegnata({});
    localStorage.removeItem(`formation-${modulo}`);
  };

  // Ottieni posizioni per il modulo corrente
  const positions = getPositionsWithLabels(configurazione);

  return (
    <div className="p-2">
      {/* Header compatto */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-1">
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
            {modulo}
          </span>
        </div>
        <button
          onClick={resetFormazione}
          className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>
      </div>

      {/* Layout orizzontale per ottimizzare lo spazio */}
      <div className="flex space-x-3">
        {/* Campo tattico a sinistra */}
        <div className="flex-shrink-0">
          <div 
            className="relative bg-gradient-to-b from-green-400 to-green-500 rounded-lg overflow-hidden"
            style={{ aspectRatio: '3/4', height: '300px' }}
          >
            {/* Linee del campo */}
            <div className="absolute inset-0">
              {/* Linea centrale */}
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white opacity-60" />
              {/* Area di rigore superiore */}
              <div className="absolute left-1/4 right-1/4 top-0 h-16 border-l-2 border-r-2 border-b-2 border-white opacity-40" />
              {/* Area di rigore inferiore */}
              <div className="absolute left-1/4 right-1/4 bottom-0 h-16 border-l-2 border-r-2 border-t-2 border-white opacity-40" />
              {/* Cerchio centrale */}
              <div className="absolute left-1/2 top-1/2 w-20 h-20 -ml-10 -mt-10 border-2 border-white rounded-full opacity-40" />
            </div>

            {/* Posizioni del modulo */}
            {positions.map((position) => {
              const giocatoreAssegnato = formazioneAssegnata[position.id];
              
              // Se c'è un giocatore assegnato, usa il suo ruolo principale
              // Altrimenti usa il ruolo principale della posizione
              let ruoloInfo;
              if (giocatoreAssegnato) {
                const ruoloGiocatore = giocatoreAssegnato.ruolo.split(';')[0];
                ruoloInfo = ruoliMantra[ruoloGiocatore] || { sigla: ruoloGiocatore, colore: 'bg-gray-500' };
              } else {
                ruoloInfo = ruoliMantra[position.ruoloPrincipale] || { sigla: position.label, colore: 'bg-gray-500' };
              }
              
              return (
                <div
                  key={position.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2"
                  style={{ 
                    left: `${position.x}%`, 
                    top: `${position.y}%` 
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, position.id, position.ruoli)}
                >
                  {giocatoreAssegnato ? (
                    // Giocatore assegnato
                    <div className="relative group">
                      <div className={`w-8 h-8 ${ruoloInfo.colore} rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg border border-white cursor-pointer hover:scale-110 transition-transform`}>
                        {ruoloInfo.sigla}
                      </div>
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity max-w-20 truncate">
                        {giocatoreAssegnato.nome}
                      </div>
                      <button
                        onClick={() => rimuoviDaPosizione(position.id)}
                        className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    // Posizione vuota
                    <div 
                      className={`w-8 h-8 ${ruoloInfo.colore} rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg border border-white border-dashed opacity-50 hover:opacity-75 transition-opacity`}
                      title={`Posizione: ${position.ruoli.join('/')}`}
                    >
                      {position.label.length > 3 ? position.label.substring(0, 3) : position.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Lista giocatori disponibili a destra */}
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
            <Move size={12} className="mr-1" />
            Giocatori Disponibili ({giocatoriRosa.filter(g => !Object.values(formazioneAssegnata).some(fg => fg?.id === g.id)).length})
          </h4>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {giocatoriRosa
              .filter(giocatore => !Object.values(formazioneAssegnata).some(g => g?.id === giocatore.id))
              .map(giocatore => {
                const ruoloPrincipale = giocatore.ruolo.split(';')[0];
                const ruoloInfo = ruoliMantra[ruoloPrincipale] || { sigla: ruoloPrincipale, colore: 'bg-gray-500' };
                
                return (
                  <div
                    key={giocatore.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, giocatore)}
                    className="flex items-center space-x-2 p-2 bg-gray-50 hover:bg-gray-100 rounded text-xs cursor-move transition-colors border border-gray-200"
                  >
                    <div className={`w-5 h-5 ${ruoloInfo.colore} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {ruoloInfo.sigla}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {giocatore.nome}
                      </div>
                      <div className="text-xs text-gray-500">
                        {giocatore.squadra}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          
          {giocatoriRosa.length === 0 && (
            <div className="text-center text-gray-500 text-xs py-8">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Nessun giocatore in rosa
            </div>
          )}
        </div>
      </div>

      {/* Info formazione compatta */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        <div>🎯 Trascina i giocatori sul campo • 💾 Salvataggio automatico</div>
      </div>
    </div>
  );
};

export default TacticalFormation;
