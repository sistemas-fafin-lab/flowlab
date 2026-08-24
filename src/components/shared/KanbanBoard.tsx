import React from 'react';
import {
  DragDropContext,
  Droppable,
  type DragStart,
  type DragUpdate,
  type DropResult,
} from '@hello-pangea/dnd';

/**
 * Casca de UI de um quadro Kanban (colunas + drag-and-drop), sem nenhum
 * conhecimento de dados/Supabase ou de qual módulo/departamento a está usando.
 * O conteúdo de cada coluna (cards, agrupamentos, formulário de "adicionar")
 * é fornecido pelo chamador via render props.
 */

export interface KanbanBoardColumnConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  dotColor: string;
}

export interface KanbanBoardProps {
  columns: KanbanBoardColumnConfig[];
  onDragStart?: (start: DragStart) => void;
  onDragUpdate?: (update: DragUpdate) => void;
  onDragEnd: (result: DropResult) => void;
  /** Contagem exibida no badge do cabeçalho da coluna. */
  getItemCount: (columnId: string) => number;
  /** Badge extra opcional ao lado da contagem (ex: soma de estimativa). */
  renderColumnBadge?: (columnId: string) => React.ReactNode;
  /** Conteúdo extra no cabeçalho da coluna, abaixo do título (ex: "adicionar card"). */
  renderColumnHeaderExtra?: (columnId: string) => React.ReactNode;
  /** Os itens (já envolvidos em `Draggable`) daquela coluna. */
  renderColumnContent: (columnId: string, isDraggingOver: boolean) => React.ReactNode;
  /** Se a coluna deve mostrar o estado vazio (o chamador decide o que conta como "vazia"). */
  isColumnEmpty: (columnId: string) => boolean;
  emptyStateLabel?: string;
  draggingOverColumn?: string | null;
  isAnyDragging?: boolean;
  className?: string;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  getItemCount,
  renderColumnBadge,
  renderColumnHeaderExtra,
  renderColumnContent,
  isColumnEmpty,
  emptyStateLabel = 'Solte aqui',
  draggingOverColumn = null,
  isAnyDragging = false,
  className = '',
}) => {
  return (
    // ZERO transform/animation/backdrop neste wrapper: animações que aplicam
    // `transform` (ex: `animate-fade-in-up` com forwards fill-mode) criam um
    // Containing Block e quebram o `position:fixed` usado pelo drag-and-drop.
    //
    // `overflow-y-hidden` é obrigatório aqui, não cosmético: por spec, um
    // elemento com só um eixo de overflow definido (`overflow-x-auto`) tem o
    // outro eixo coagido para `auto` pelo browser caso contrário. Isso torna
    // este wrapper um segundo scroll parent "acima" do Droppable de cada
    // coluna (que também é `overflow-y-auto`) — o @hello-pangea/dnd só
    // suporta um scroll parent por Droppable, e com dois ele mede errado no
    // início do drag (mesmo sintoma de "pisca"/muda de altura que o
    // comentário no Droppable abaixo já descreve).
    <div className={`overflow-x-auto overflow-y-hidden pb-4 -mx-1 px-1 ${className}`}>
      <DragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
        <div className="flex gap-4 min-w-max">
          {columns.map((column) => {
            const Icon = column.icon;
            const count = getItemCount(column.id);

            return (
              <div key={column.id} className="flex flex-col w-[280px] sm:w-[300px] flex-shrink-0">
                {/* Column header */}
                <div className="flex items-center gap-2.5 px-3 py-3 mb-2">
                  <span className={`w-2 h-2 rounded-full ${column.dotColor}`} />
                  <Icon className={`w-4 h-4 ${column.accent}`} />
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{column.label}</h3>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md tabular-nums">
                      {count}
                    </span>
                    {renderColumnBadge?.(column.id)}
                  </div>
                </div>

                {renderColumnHeaderExtra?.(column.id)}

                {/* Column body */}
                {/* O Droppable precisa ser o próprio container de scroll — se o
                    scroll (overflow-y-auto/maxHeight) viver num filho aninhado
                    em vez do elemento com `provided.innerRef`, o
                    @hello-pangea/dnd mede o container errado ao iniciar o
                    drag e a coluna "pisca"/muda de altura nesse instante. */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 flex flex-col gap-4 min-h-[200px] rounded-xl p-2 overflow-y-auto transition-colors duration-200 ${
                        snapshot.isDraggingOver
                          ? 'bg-violet-50/60 dark:bg-violet-900/15 ring-2 ring-violet-400/50 ring-inset'
                          : draggingOverColumn === column.id
                            ? 'bg-violet-50/35 dark:bg-violet-900/10 ring-1 ring-violet-300/40 dark:ring-violet-700/40'
                            : isAnyDragging
                              ? 'bg-gray-50/60 dark:bg-gray-800/45'
                              : 'bg-gray-50/50 dark:bg-gray-800/40'
                      }`}
                      style={{ maxHeight: 'calc(100vh - 300px)' }}
                    >
                      {renderColumnContent(column.id, snapshot.isDraggingOver)}

                      {isColumnEmpty(column.id) && !snapshot.isDraggingOver && (
                        <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 transition-colors">
                          <Icon className="w-6 h-6 text-gray-300 dark:text-gray-600 mb-1.5" />
                          <span className="text-xs text-gray-400 dark:text-gray-500">{emptyStateLabel}</span>
                        </div>
                      )}

                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};

export default KanbanBoard;
