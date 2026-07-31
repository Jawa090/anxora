import React, { createContext, useContext, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

interface CustomField {
  key: string;
  value: string;
}

interface DraggableFieldsContextType {
  activeField: CustomField | null;
  setActiveField: (field: CustomField | null) => void;
  onFieldMove: (fieldKey: string, targetSection: string) => void;
}

const DraggableFieldsContext = createContext<DraggableFieldsContextType | null>(null);

export function useDraggableFields() {
  const context = useContext(DraggableFieldsContext);
  if (!context) {
    throw new Error("useDraggableFields must be used within DraggableFieldsProvider");
  }
  return context;
}

interface DraggableFieldsProviderProps {
  children: React.ReactNode;
  customFields: CustomField[];
  onCustomFieldsChange: (fields: CustomField[]) => void;
  onFieldMoveToSection?: (fieldKey: string, fieldValue: string, targetSection: string) => void;
}

export function DraggableFieldsProvider({
  children,
  customFields,
  onCustomFieldsChange,
  onFieldMoveToSection,
}: DraggableFieldsProviderProps) {
  const [activeField, setActiveField] = useState<CustomField | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const field = customFields.find((f) => f.key === active.id);
    if (field) {
      setActiveField(field);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveField(null);

    if (!over) return;

    const fieldKey = active.id as string;
    const targetSection = over.id as string;

    // If dropped on a section (not custom-fields)
    if (targetSection !== "custom-fields" && onFieldMoveToSection) {
      const field = customFields.find((f) => f.key === fieldKey);
      if (field) {
        // Remove from custom fields
        const newCustomFields = customFields.filter((f) => f.key !== fieldKey);
        onCustomFieldsChange(newCustomFields);
        
        // Notify parent to add to target section
        onFieldMoveToSection(field.key, field.value, targetSection);
      }
    }
  };

  const onFieldMove = (fieldKey: string, targetSection: string) => {
    if (targetSection !== "custom-fields" && onFieldMoveToSection) {
      const field = customFields.find((f) => f.key === fieldKey);
      if (field) {
        const newCustomFields = customFields.filter((f) => f.key !== fieldKey);
        onCustomFieldsChange(newCustomFields);
        onFieldMoveToSection(field.key, field.value, targetSection);
      }
    }
  };

  return (
    <DraggableFieldsContext.Provider value={{ activeField, setActiveField, onFieldMove }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay>
          {activeField ? (
            <div className="bg-primary/20 border-2 border-primary rounded-lg p-3 shadow-xl">
              <div className="text-sm font-medium text-foreground">
                {activeField.key}: {activeField.value}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DraggableFieldsContext.Provider>
  );
}
