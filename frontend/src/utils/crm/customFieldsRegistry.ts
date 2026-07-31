import { customFieldTemplatesApi } from '@/lib/api';

export interface CustomFieldTemplate {
  key: string;
  type: string;
  sectionId?: string;
}

/**
 * Gets the persisted custom field templates for a specific entity type from the server.
 */
export const fetchCustomFieldTemplates = async (entityType: 'lead' | 'deal'): Promise<CustomFieldTemplate[]> => {
  try {
    return await customFieldTemplatesApi.get(entityType);
  } catch (e) {
    console.error('Failed to fetch custom field templates from server', e);
    // Fallback to local storage for offline/error resilience during transition
    return getCustomFieldTemplates(entityType);
  }
};

/**
 * Persists a list of custom field definitions as templates to the server.
 */
export const saveCustomFieldTemplatesToServer = async (entityType: 'lead' | 'deal', fields: { key: string; type?: string; sectionId?: string }[]) => {
  try {
    const templates = fields
      .filter(f => f.key && f.key.trim() !== '')
      .map(f => ({
        key: f.key.trim(),
        type: f.type || 'string',
        sectionId: f.sectionId
      }));

    // Deduplicate
    const uniqueTemplates = Array.from(
      new Map(templates.map(item => [item.key, item])).values()
    );

    await customFieldTemplatesApi.save(entityType, uniqueTemplates);
    
    // Also update local storage for redundancy
    saveCustomFieldTemplates(entityType, uniqueTemplates as any);
  } catch (e) {
    console.error('Failed to save custom field templates to server', e);
    // Fallback to local storage if server fails
    saveCustomFieldTemplates(entityType, fields);
  }
};

/**
 * Gets the persisted custom field templates for a specific entity type from localStorage (Legacy/Fallback).
 */
export const getCustomFieldTemplates = (entityType: 'lead' | 'deal', orgId?: string): CustomFieldTemplate[] => {
  try {
    const key = orgId ? `crm_custom_fields_template_${entityType}_${orgId}` : `crm_custom_fields_template_${entityType}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load custom field templates from localStorage', e);
    return [];
  }
};

/**
 * Persists a list of custom field definitions as templates for future records in localStorage (Legacy/Fallback).
 */
export const saveCustomFieldTemplates = (entityType: 'lead' | 'deal', fields: { key: string; type?: string; sectionId?: string }[], orgId?: string) => {
  try {
    const templates: CustomFieldTemplate[] = fields
      .filter(f => f.key && f.key.trim() !== '')
      .map(f => ({
        key: f.key.trim(),
        type: (f as any).type || 'string',
        sectionId: (f as any).sectionId
      }));

    const uniqueTemplates = Array.from(
      new Map(templates.map(item => [item.key, item])).values()
    );

    const key = orgId ? `crm_custom_fields_template_${entityType}_${orgId}` : `crm_custom_fields_template_${entityType}`;
    localStorage.setItem(key, JSON.stringify(uniqueTemplates));
  } catch (e) {
    console.error('Failed to save custom field templates to localStorage', e);
  }
};

/**
 * Merges existing field values with templates to ensure all standard custom fields are present.
 * Note: This version is synchronous and uses the provided templates.
 */
export const mergeFieldsWithTemplatesSync = (
  existingFields: { id: string; key: string; value: string; type?: string; sectionId?: string }[],
  templates: CustomFieldTemplate[]
) => {
  const merged = [...existingFields];

  templates.forEach(template => {
    const existingIndex = merged.findIndex(f => f.key === template.key);
    if (existingIndex !== -1) {
      if (template.sectionId) {
        merged[existingIndex] = { ...merged[existingIndex], sectionId: template.sectionId };
      }
    } else {
      merged.push({
        id: `template-${Math.random().toString(36).substr(2, 9)}`,
        key: template.key,
        value: "",
        type: template.type,
        sectionId: template.sectionId || "custom-fields"
      });
    }
  });

  return merged;
};

// Legacy support for the sync version
export const mergeFieldsWithTemplates = (
  entityType: 'lead' | 'deal', 
  existingFields: { id: string; key: string; value: string; type?: string; sectionId?: string }[],
  orgId?: string
) => {
  const templates = getCustomFieldTemplates(entityType, orgId);
  return mergeFieldsWithTemplatesSync(existingFields, templates);
};
