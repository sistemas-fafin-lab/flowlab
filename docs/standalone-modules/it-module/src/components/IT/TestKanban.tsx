import React, { useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';

// ═══════════════════════════════════════════════════════════════════════════════
// MINIMAL KANBAN - CLEAN ROOM TEST
// ═══════════════════════════════════════════════════════════════════════════════

interface Task {
  id: string;
  title: string;
}

interface ColumnData {
  id: string;
  title: string;
  tasks: Task[];
}

const INITIAL_DATA: ColumnData[] = [
  {
    id: 'col-1',
    title: 'Backlog',
    tasks: [
      { id: 'task-1', title: 'Tarefa 1' },
      { id: 'task-2', title: 'Tarefa 2' },
      { id: 'task-3', title: 'Tarefa 3' },
    ],
  },
  {
    id: 'col-2',
    title: 'Em Progresso',
    tasks: [
      { id: 'task-4', title: 'Tarefa 4' },
      { id: 'task-5', title: 'Tarefa 5' },
    ],
  },
  {
    id: 'col-3',
    title: 'Concluído',
    tasks: [
      { id: 'task-6', title: 'Tarefa 6' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES - INLINE, ZERO TAILWIND
// ═══════════════════════════════════════════════════════════════════════════════

const styles = {
  container: {
    display: 'flex',
    gap: '16px',
    padding: '20px',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  } as React.CSSProperties,

  column: {
    width: '280px',
    backgroundColor: '#e0e0e0',
    borderRadius: '8px',
    padding: '12px',
    border: '2px solid #bbb',
  } as React.CSSProperties,

  columnTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '12px',
    padding: '8px',
    backgroundColor: '#ccc',
    borderRadius: '4px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  droppableArea: {
    minHeight: '200px',
    padding: '4px',
    backgroundColor: '#d5d5d5',
    borderRadius: '4px',
  } as React.CSSProperties,

  droppableAreaDraggingOver: {
    minHeight: '200px',
    padding: '4px',
    backgroundColor: '#b8d4ff',
    borderRadius: '4px',
    border: '2px dashed #3b82f6',
  } as React.CSSProperties,

  card: {
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #999',
    borderRadius: '4px',
    cursor: 'grab',
    userSelect: 'none' as const,
  } as React.CSSProperties,

  cardDragging: {
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: '#fffbcc',
    border: '2px solid #f59e0b',
    borderRadius: '4px',
    cursor: 'grabbing',
    userSelect: 'none' as const,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  } as React.CSSProperties,
};

// ═══════════════════════════════════════════════════════════════════════════════
// CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const TaskCard: React.FC<{ task: Task; index: number }> = ({ task, index }) => {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            ...(snapshot.isDragging ? styles.cardDragging : styles.card),
            ...provided.draggableProps.style,
          }}
        >
          <strong>{task.id}</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>{task.title}</p>
        </div>
      )}
    </Draggable>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Column: React.FC<{ column: ColumnData }> = ({ column }) => {
  return (
    <div style={styles.column}>
      <div style={styles.columnTitle}>
        {column.title} ({column.tasks.length})
      </div>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={snapshot.isDraggingOver ? styles.droppableAreaDraggingOver : styles.droppableArea}
          >
            {column.tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const TestKanban: React.FC = () => {
  const [columns, setColumns] = useState<ColumnData[]>(INITIAL_DATA);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Dropped outside
    if (!destination) return;

    // Same position
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    setColumns((prev) => {
      const newColumns = prev.map((col) => ({
        ...col,
        tasks: [...col.tasks],
      }));

      const sourceColIndex = newColumns.findIndex((c) => c.id === source.droppableId);
      const destColIndex = newColumns.findIndex((c) => c.id === destination.droppableId);

      if (sourceColIndex === -1 || destColIndex === -1) return prev;

      const [movedTask] = newColumns[sourceColIndex].tasks.splice(source.index, 1);

      if (!movedTask) return prev;

      newColumns[destColIndex].tasks.splice(destination.index, 0, movedTask);

      return newColumns;
    });

    console.log(`Moved ${draggableId} from ${source.droppableId} to ${destination.droppableId}`);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
          🧪 Test Kanban - Clean Room
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
          Arraste os cards para testar o comportamento do drag-and-drop sem Tailwind.
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          {columns.map((column) => (
            <Column key={column.id} column={column} />
          ))}
        </div>
      </div>
    </DragDropContext>
  );
};

export default TestKanban;
