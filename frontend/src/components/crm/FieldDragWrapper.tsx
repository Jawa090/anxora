import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CustomField {
  id: string;
  key: string;
  value: string;
  sectionId?: string;
  afterFieldId?: string; // New: ID of the field (fixed or custom) this field should follow
}

interface FieldDragWrapperProps {
  children: React.ReactNode;
  customFields: CustomField[];
  onCustomFieldsChange: (fields: CustomField[]) => void;
  onFieldDropToSection: (fieldKey: string, fieldValue: string, sectionId: string, updatedFields?: CustomField[]) => void;
  editing: boolean;
}

export function FieldDragWrapper({
  children,
  customFields,
  onCustomFieldsChange,
  onFieldDropToSection,
  editing,
}: FieldDragWrapperProps) {
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
    const field = customFields.find((f) => f.id === active.id);
    if (field) {
      setActiveField(field);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveField(null);

    if (!over) {
      console.log("Dropped outside any target");
      return;
    }

    const fieldId = active.id as string;
    let targetId = over.id as string;

    if (!editing) return;

    // Find the field in customFields
    const fieldIndex = customFields.findIndex((f) => f.id === fieldId);
    if (fieldIndex === -1) return;

    const field = customFields[fieldIndex];

    // Check if target is a fixed field
    const isFixedField = targetId.startsWith('fixed-');
    
    // If target is another custom field
    const targetField = customFields.find(f => f.id === targetId);

    // Identify target section
    let targetSectionId = targetId;
    if (targetField) {
      targetSectionId = targetField.sectionId || "custom-fields";
    } else if (isFixedField) {
      // For fixed fields, we need to extract the section they belong to
      // We'll pass the section as a data attribute or prefix
      // For now, let's assume the ID format is fixed-[sectionId]-[fieldName]
      const parts = targetId.split('-');
      if (parts.length >= 3) {
        // e.g., fixed-lead-company-details-pipeline
        // Reconstruct sectionId from parts
        if (targetId.includes('lead-company-details')) targetSectionId = 'lead-company-details';
        else if (targetId.includes('activity-tracking')) targetSectionId = 'activity-tracking';
        else if (targetId.includes('qualification-opportunity')) targetSectionId = 'qualification-opportunity';
        else if (targetId.includes('source-section')) targetSectionId = 'source-section';
        else if (targetId.includes('deal-info')) targetSectionId = 'deal-info';
        else if (targetId.includes('contact-info')) targetSectionId = 'contact-info';
        else if (targetId.includes('company-info')) targetSectionId = 'company-info';
        else if (targetId.includes('about-deal')) targetSectionId = 'about-deal';
        else if (targetId.includes('more-section')) targetSectionId = 'more-section';
      }
    }

    // List of valid section IDs across leads and deals
    const validSections = [
      "custom-fields",
      "lead-company-details",
      "activity-tracking",
      "qualification-opportunity",
      "source-section",
      "deal-info",
      "contact-info",
      "company-info",
      "about-deal",
      "more-section",
      "budget-payment",
      "project-details",
      "marketing-qualification"
    ];

    const isValidSection = validSections.some(s => targetSectionId === s || targetSectionId === `${s}-top`);
    
    if (!isValidSection && !targetField && !isFixedField) {
      console.warn(`Dropped on invalid target: ${targetId}`);
      return;
    }

    const newCustomFields = [...customFields];
    const currentSectionId = field.sectionId || "custom-fields";
    
    // Normalize targetSectionId (strip -top)
    const normalizedSectionId = targetSectionId.replace(/-top$/, '');

    // Update the field with new section and placement info
    const updatedField = { 
      ...field, 
      sectionId: normalizedSectionId,
      afterFieldId: isFixedField ? targetId : (targetField ? targetField.id : (targetSectionId.endsWith('-top') ? targetSectionId : undefined))
    };
    
    newCustomFields[fieldIndex] = updatedField;
    
    let finalFields = newCustomFields;
    if (targetField) {
      const oldIndex = fieldIndex;
      const newIndex = newCustomFields.findIndex(f => f.id === targetField.id);
      finalFields = arrayMove(newCustomFields, oldIndex, newIndex);
    } else if (targetSectionId.endsWith('-top')) {
      const oldIndex = fieldIndex;
      // When moving to top, we can reorder in array too, but afterFieldId is the source of truth for anchored rendering
      finalFields = arrayMove(newCustomFields, oldIndex, 0);
    }
    
    onCustomFieldsChange(finalFields);
    onFieldDropToSection(field.key, field.value, normalizedSectionId, finalFields);
    
    const displayTarget = isFixedField 
      ? targetId.split('-').pop()?.replace(/_/g, ' ') 
      : targetSectionId.replace(/-top$/, '').replace(/-/g, ' ');
      
    toast.success(`Placed "${field.key}" near ${displayTarget}`);
  };

  if (!editing) {
    return <>{children}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={customFields.map((f) => f.id)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
      <DragOverlay>
        {activeField ? (
          <div className="bg-white border-2 border-primary rounded-lg p-4 shadow-2xl z-[9999]">
            <div className="text-sm font-semibold text-foreground">
              <span className="text-primary">{activeField.key}:</span>
              <span className="ml-2 text-muted-foreground">{activeField.value}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

import { useDroppable } from "@dnd-kit/core";

export function DroppableField({ id, children, editing, className }: { id: string, children: React.ReactNode, editing: boolean, className?: string }) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled: !editing,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative transition-all duration-200",
        isOver && editing && "ring-2 ring-primary ring-offset-4 bg-primary/5 rounded-xl z-10 scale-[1.02] shadow-lg",
        className
      )}
    >
      {children}
      {isOver && editing && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] px-2 py-0.5 rounded-full z-20 whitespace-nowrap animate-bounce">
          Drop after this field
        </div>
      )}
    </div>
  );
}
