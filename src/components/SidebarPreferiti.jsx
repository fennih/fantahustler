// Sidebar compatta per gestire i preferiti e le note durante l'asta
import React, { useState } from 'react';
import { Star, Target, Eye, EyeOff, Edit3, Trash2, Heart } from 'lucide-react';

const SidebarPreferiti = ({ 
  preferiti, 
  noteGiocatori, 
  onTogglePreferito, 
  onAggiornaNote, 
  onFocusGiocatore,
  isVisible = true,
  onToggleVisibility 
}) => {
  const [filtroRuolo, setFiltroRuolo] = useState('TUTTI');
  const [editingNote, setEditingNote] = useState(null);

  // Raggruppa preferiti per ruolo
  const preferitiPerRuolo = preferiti.reduce((acc, giocatore) => {
    const ruolo = giocatore.ruolo || 'ALTRO';
    if (!acc[ruolo]) acc[ruolo] = [];
    acc[ruolo].push(giocatore);
    return acc;
  }, {});

  const ruoli = ['TUTTI', 'Por', 'Dc', 'Dd', 'Ds', 'E', 'M', 'C', 'W', 'T', 'A', 'Pc'];
  
  const preferitiDaMostrare = filtroRuolo === 'TUTTI' 
    ? preferiti 
    : preferiti.filter(g => g.ruolo === filtroRuolo);

  const handleSaveNote = (giocatore, nota) => {
    onAggiornaNote(giocatore, nota);
    setEditingNote(null);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 md:w-80 w-[90vw] bg-white border-l border-gray-200 shadow-xl z-30 overflow-hidden flex flex-col max-w-[90vw]">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-red-500 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Heart size={20} />
            <h2 className="font-bold text-lg">I Miei Preferiti</h2>
            <span className="bg-white/20 px-2 py-1 rounded-full text-sm">
              {preferiti.length}
            </span>
          </div>
          <button
            onClick={onToggleVisibility}
            className="p-1 hover:bg-white/20 rounded"
            title="Nascondi sidebar"
          >
            <EyeOff size={18} />
          </button>
        </div>
        
        {/* Filtro ruoli compatto */}
        <div className="mt-3">
          <div className="flex flex-wrap gap-1">
            {ruoli.map(ruolo => (
              <button
                key={ruolo}
                onClick={() => setFiltroRuolo(ruolo)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filtroRuolo === ruolo
                    ? 'bg-white text-pink-600 font-medium'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {ruolo === 'TUTTI' ? 'Tutti' : ruolo}
                {ruolo !== 'TUTTI' && preferitiPerRuolo[ruolo] && (
                  <span className="ml-1">({preferitiPerRuolo[ruolo].length})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista preferiti */}
      <div className="flex-1 overflow-y-auto p-2">
        {preferitiDaMostrare.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Heart size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              {filtroRuolo === 'TUTTI' 
                ? 'Nessun giocatore preferito' 
                : `Nessun ${filtroRuolo} preferito`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {preferitiDaMostrare
              .sort((a, b) => {
                // Prima giocatori con note, poi per FVM decrescente
                const aNota = noteGiocatori[`${a.nome}_${a.squadra}`] || '';
                const bNota = noteGiocatori[`${b.nome}_${b.squadra}`] || '';
                
                if (aNota && !bNota) return -1;
                if (!aNota && bNota) return 1;
                
                return (b.FVM || 0) - (a.FVM || 0);
              })
              .map((giocatore, index) => {
                const nota = noteGiocatori[`${giocatore.nome}_${giocatore.squadra}`] || '';
                const hasNota = nota.trim().length > 0;
                
                return (
                  <div
                    key={`${giocatore.nome}_${giocatore.squadra}`}
                    className={`bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 border-l-4 transition-all hover:shadow-md cursor-pointer ${
                      hasNota 
                        ? 'border-l-green-500 bg-gradient-to-r from-green-50 to-emerald-50' 
                        : 'border-l-pink-400'
                    }`}
                    onClick={() => onFocusGiocatore?.(giocatore)}
                  >
                    {/* Header giocatore */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900 text-sm">
                            {giocatore.nome}
                          </span>
                          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-medium">
                            {giocatore.ruolo}
                          </span>
                          {hasNota && (
                            <Target size={12} className="text-green-600" title="Ha note" />
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {giocatore.squadra} • FVM: {giocatore.FVM || 'N/A'}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNote(editingNote === giocatore ? null : giocatore);
                          }}
                          className="p-1 hover:bg-white/50 rounded transition-colors"
                          title="Modifica note"
                        >
                          <Edit3 size={12} className="text-gray-500" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePreferito(giocatore);
                          }}
                          className="p-1 hover:bg-white/50 rounded transition-colors"
                          title="Rimuovi dai preferiti"
                        >
                          <Trash2 size={12} className="text-red-500" />
                        </button>
                      </div>
                    </div>

                    {/* Note esistenti */}
                    {hasNota && editingNote !== giocatore && (
                      <div className="mt-2 p-2 bg-green-100 rounded text-xs border border-green-200">
                        <div className="flex items-start space-x-1">
                          <Target size={12} className="text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-green-800 font-medium">{nota}</span>
                        </div>
                      </div>
                    )}

                    {/* Editor note */}
                    {editingNote === giocatore && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={nota}
                          onChange={(e) => onAggiornaNote(giocatore, e.target.value)}
                          placeholder="Aggiungi note per l'asta..."
                          className="w-full p-2 text-xs border border-gray-300 rounded resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          rows="2"
                          autoFocus
                        />
                        <div className="flex space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNote(null);
                            }}
                            className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                          >
                            Salva
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAggiornaNote(giocatore, '');
                              setEditingNote(null);
                            }}
                            className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                          >
                            Cancella
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Quick stats */}
                    <div className="mt-2 flex justify-between text-xs text-gray-500">
                      <span>Slot: {giocatore.slotMax || 'N/A'}</span>
                      <span>Squadra: {giocatore.squadra}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Footer azioni rapide */}
      <div className="border-t border-gray-200 p-3 bg-gray-50">
        <div className="text-xs text-gray-600 mb-2">
          Preferiti con note: {preferiti.filter(g => 
            (noteGiocatori[`${g.nome}_${g.squadra}`] || '').trim().length > 0
          ).length}
        </div>
        <button
          onClick={() => {
            const prefertiConNote = preferiti.filter(g => 
              (noteGiocatori[`${g.nome}_${g.squadra}`] || '').trim().length > 0
            );
            if (prefertiConNote.length > 0) {
              onFocusGiocatore?.(prefertiConNote[0]);
            }
          }}
          className="w-full px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors flex items-center justify-center space-x-2"
        >
          <Target size={16} />
          <span>Vai al prossimo target</span>
        </button>
      </div>
    </div>
  );
};

export default SidebarPreferiti;
