import { Env } from '../lib/types';
import { createSupabaseClient } from '../lib/supabase';
import { RootCauseResult } from './rootCauseAnalysis';
import OpenAI from 'openai';

/**
 * Generative remediation script interface
 */
export interface GenerativeRemediationScript {
  id: string;
  anomaly_id: string;
  root_cause_analysis: RootCauseResult;
  generated_script: string;
  script_language: string;
  target_system: string;
  confidence_score: number;
  validation_status: 'PENDING' | 'PASSED' | 'FAILED';
  execution_status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  approval_status: 'REQUIRED' | 'APPROVED' | 'REJECTED';
  created_at: string;
  validated_at?: string;
  executed_at?: string;
  approved_at?: string;
}

/**
 * Generative remediation template interface
 */
export interface GenerativeRemediationTemplate {
  id: string;
  root_cause_category: string;
  template_content: string;
  target_systems: string[];
  required_capabilities: Record<string, any>;
  safety_checks: Record<string, any>;
  template_variables: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Confidence levels for script generation
 */
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Get all generative remediation scripts
 * @param env Environment variables
 * @returns Array of generative remediation scripts
 */
export async function getGenerativeRemediationScripts(env: Env): Promise<GenerativeRemediationScript[]> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('generative_remediation_scripts')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching generative remediation scripts:', error);
    throw new Error('Failed to fetch generative remediation scripts');
  }
  
  return data || [];
}

/**
 * Get a generative remediation script by ID
 * @param env Environment variables
 * @param id Script ID
 * @returns Generative remediation script
 */
export async function getGenerativeRemediationScriptById(env: Env, id: string): Promise<GenerativeRemediationScript | null> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('generative_remediation_scripts')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching generative remediation script:', error);
    return null;
  }
  
  return data;
}

/**
 * Create a new generative remediation script
 * @param env Environment variables
 * @param script Script to create
 * @returns Created generative remediation script
 */
export async function createGenerativeRemediationScript(
  env: Env,
  script: Omit<GenerativeRemediationScript, 'id' | 'created_at'>
): Promise<GenerativeRemediationScript> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('generative_remediation_scripts')
    .insert(script)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating generative remediation script:', error);
    throw new Error('Failed to create generative remediation script');
  }
  
  return data;
}

/**
 * Update a generative remediation script
 * @param env Environment variables
 * @param id Script ID
 * @param updates Updates to apply
 * @returns Updated generative remediation script
 */
export async function updateGenerativeRemediationScript(
  env: Env,
  id: string,
  updates: Partial<GenerativeRemediationScript>
): Promise<GenerativeRemediationScript> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('generative_remediation_scripts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating generative remediation script:', error);
    throw new Error('Failed to update generative remediation script');
  }
  
  return data;
}

/**
 * Delete a generative remediation script
 * @param env Environment variables
 * @param id Script ID
 */
export async function deleteGenerativeRemediationScript(env: Env, id: string): Promise<void> {
  const supabase = createSupabaseClient(env);
  
  const { error } = await supabase
    .from('generative_remediation_scripts')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting generative remediation script:', error);
    throw new Error('Failed to delete generative remediation script');
  }
}

/**
 * Get all generative remediation templates
 * @param env Environment variables
 * @returns Array of generative remediation templates
 */
export async function getGenerativeRemediationTemplates(env: Env): Promise<GenerativeRemediationTemplate[]> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('generative_remediation_templates')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching generative remediation templates:', error);
    throw new Error('Failed to fetch generative remediation templates');
  }
  
  return data || [];
}

/**
 * Get a generative remediation template by ID
 * @param env Environment variables
 * @param id Template ID
 * @returns Generative remediation template
 */
export async function getGenerativeRemediationTemplateById(env: Env, id: string): Promise<GenerativeRemediationTemplate | null> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('generative_remediation_templates')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching generative remediation template:', error);
    return null;
  }
  
  return data;
}

/**
 * Create a new generative remediation template
 * @param env Environment variables
 * @param template Template to create
 * @returns Created generative remediation template
 */
export async function createGenerativeRemediationTemplate(
  env: Env,
  template: Omit<GenerativeRemediationTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<GenerativeRemediationTemplate> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('generative_remediation_templates')
    .insert(template)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating generative remediation template:', error);
    throw new Error('Failed to create generative remediation template');
  }
  
  return data;
}

/**
 * Update a generative remediation template
 * @param env Environment variables
 * @param id Template ID
 * @param updates Updates to apply
 * @returns Updated generative remediation template
 */
export async function updateGenerativeRemediationTemplate(
  env: Env,
  id: string,
  updates: Partial<GenerativeRemediationTemplate>
): Promise<GenerativeRemediationTemplate> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('generative_remediation_templates')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating generative remediation template:', error);
    throw new Error('Failed to update generative remediation template');
  }
  
  return data;
}

/**
 * Delete a generative remediation template
 * @param env Environment variables
 * @param id Template ID
 */
export async function deleteGenerativeRemediationTemplate(env: Env, id: string): Promise<void> {
  const supabase = createSupabaseClient(env);
  
  const { error } = await supabase
    .from('generative_remediation_templates')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting generative remediation template:', error);
    throw new Error('Failed to delete generative remediation template');
  }
}

/**
 * Select the best template for a given root cause category
 * @param env Environment variables
 * @param rootCauseCategory Root cause category
 * @returns Best matching template or null
 */
export async function selectTemplateForRootCause(
  env: Env,
  rootCauseCategory: string
): Promise<GenerativeRemediationTemplate | null> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('generative_remediation_templates')
    .select('*')
    .eq('root_cause_category', rootCauseCategory)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    console.error('Error selecting template for root cause:', error);
    return null;
  }
  
  return data;
}

/**
 * Generate a remediation script using OpenAI based on RCA findings
 * @param env Environment variables
 * @param anomalyId The ID of the anomaly
 * @param rootCauseAnalysis The RCA findings
 * @param template The template to use for generation
 * @returns Generated script with confidence score
 */
export async function generateRemediationScript(
  env: Env,
  anomalyId: string,
  rootCauseAnalysis: RootCauseResult,
  template: GenerativeRemediationTemplate
): Promise<{ script: string; confidenceScore: number }> {
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    });
    
    // Prepare the prompt with the template and RCA findings
    const prompt = `
    Based on the following root cause analysis, generate a remediation script using the provided template.
    
    Root Cause Analysis:
    Category: ${rootCauseAnalysis.root_cause_category}
    Details: ${rootCauseAnalysis.root_cause_details}
    Confidence: ${rootCauseAnalysis.confidence_score}
    Suggested Actions: ${rootCauseAnalysis.suggested_actions.join(', ')}
    
    Template:
    ${template.template_content}
    
    Please generate a specific remediation script that addresses this root cause.
    Fill in the template variables with appropriate values based on the root cause analysis.
    Ensure the script follows best practices for the target system and includes proper error handling.
    `;
    
    // Call OpenAI API to generate the script
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert DevOps engineer specializing in automated remediation script generation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });
    
    const generatedScript = completion.choices[0].message.content || '';
    
    // Calculate confidence score based on RCA confidence and template match
    let confidenceScore = 0.5; // Base confidence
    
    // Adjust based on RCA confidence
    if (rootCauseAnalysis.confidence_score === 'HIGH') {
      confidenceScore += 0.3;
    } else if (rootCauseAnalysis.confidence_score === 'MEDIUM') {
      confidenceScore += 0.1;
    }
    
    // Adjust based on template specificity (simplified)
    if (template.template_variables && Object.keys(template.template_variables).length > 0) {
      confidenceScore += 0.1;
    }
    
    // Ensure confidence score is between 0 and 1
    confidenceScore = Math.min(1, Math.max(0, confidenceScore));
    
    return {
      script: generatedScript,
      confidenceScore
    };
  } catch (error) {
    console.error('Error generating remediation script:', error);
    throw new Error('Failed to generate remediation script');
  }
}

/**
 * Validate a generated script for safety and correctness
 * @param env Environment variables
 * @param script The script to validate
 * @param targetSystem The target system for the script
 * @returns Validation result
 */
export async function validateScript(
  env: Env,
  script: string,
  targetSystem: string
): Promise<{ isValid: boolean; errors: string[] }> {
  // This is a simplified validation implementation
  // In a real system, this would include:
  // - Syntax validation using appropriate parsers
  // - Forbidden command checks based on target system
  // - Resource limit verification
  // - Access control validation
  
  const errors: string[] = [];
  
  // Basic validation checks
  if (!script || script.trim().length === 0) {
    errors.push('Script is empty');
  }
  
  // Check for dangerous commands based on target system
  if (targetSystem === 'bash' || targetSystem === 'shell') {
    const dangerousCommands = ['rm -rf /', 'rm -rf /*', ':(){ :|:& };:', 'dd if=/dev/zero of=/dev/sda'];
    for (const cmd of dangerousCommands) {
      if (script.includes(cmd)) {
        errors.push(`Dangerous command detected: ${cmd}`);
      }
    }
  }
  
  // In a real implementation, we would add more sophisticated validation
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Approve a generated script for execution
 * @param env Environment variables
 * @param id Script ID
 * @returns Updated script
 */
export async function approveScript(env: Env, id: string): Promise<GenerativeRemediationScript> {
  return updateGenerativeRemediationScript(env, id, {
    approval_status: 'APPROVED',
    approved_at: new Date().toISOString()
  });
}

/**
 * Reject a generated script
 * @param env Environment variables
 * @param id Script ID
 * @returns Updated script
 */
export async function rejectScript(env: Env, id: string): Promise<GenerativeRemediationScript> {
  return updateGenerativeRemediationScript(env, id, {
    approval_status: 'REJECTED',
    approved_at: new Date().toISOString()
  });
}

/**
 * Execute a validated script
 * @param env Environment variables
 * @param id Script ID
 * @returns Execution result
 */
export async function executeScript(
  env: Env,
  id: string
): Promise<{ status: 'SUCCESS' | 'FAILED'; result: any }> {
  try {
    // Update script status to RUNNING
    await updateGenerativeRemediationScript(env, id, {
      execution_status: 'RUNNING',
      executed_at: new Date().toISOString()
    });
    
    // In a real implementation, this would:
    // 1. Send the script to the appropriate agent for execution
    // 2. Monitor the execution progress
    // 3. Update the script status with the result
    
    // For now, we'll simulate a successful execution
    const result = { message: 'Script executed successfully' };
    
    // Update script status to SUCCESS
    await updateGenerativeRemediationScript(env, id, {
      execution_status: 'SUCCESS'
    });
    
    return { status: 'SUCCESS', result };
  } catch (error) {
    console.error('Error executing script:', error);
    
    // Update script status to FAILED
    await updateGenerativeRemediationScript(env, id, {
      execution_status: 'FAILED'
    });
    
    return { status: 'FAILED', result: { error: error.message } };
  }
}