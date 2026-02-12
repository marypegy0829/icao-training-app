
import { supabase } from './supabaseClient';

export interface MistakeEntry {
    id: string;
    source_scenario_title: string;
    original_text: string;
    correction: string;
    issue_type: string;
    explanation: string;
    is_mastered: boolean;
    created_at: string;
}

export const mistakeService = {
    async addMistake(
        userId: string, 
        scenarioTitle: string, 
        original: string, 
        correction: string, 
        issue: string, 
        explanation: string
    ) {
        if (!userId) return;

        const { error } = await supabase.from('mistake_book').insert({
            user_id: userId,
            source_scenario_title: scenarioTitle,
            original_text: original,
            correction: correction,
            issue_type: issue,
            explanation: explanation
        });

        if (error) throw error;
    },

    async getMistakes(userId: string): Promise<MistakeEntry[]> {
        if (!userId) return [];

        const { data, error } = await supabase
            .from('mistake_book')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Failed to fetch mistakes:", error);
            return [];
        }
        return data as MistakeEntry[];
    },

    async toggleMastered(mistakeId: string, isMastered: boolean) {
        const { error } = await supabase
            .from('mistake_book')
            .update({ is_mastered: isMastered })
            .eq('id', mistakeId);
        
        if (error) throw error;
    },

    async deleteMistake(mistakeId: string) {
        const { error } = await supabase
            .from('mistake_book')
            .delete()
            .eq('id', mistakeId);
        
        if (error) throw error;
    }
};
