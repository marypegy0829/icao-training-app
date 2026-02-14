
import { supabase } from './supabaseClient';

export interface MistakeEntry {
    id: string;
    source_scenario_title: string;
    original_text: string;
    correction: string;
    issue_type: string;
    explanation: string;
    is_mastered: boolean;
    review_count: number;
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

        // P0: Prevent Duplicates (Check if same original text exists for this user)
        const { data: existing } = await supabase
            .from('mistake_book')
            .select('id')
            .eq('user_id', userId)
            .eq('original_text', original)
            .maybeSingle();

        if (existing) {
            console.log("Mistake already exists, skipping duplicate insert.");
            return;
        }

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

    // P2: Pagination Limit (Default 100 to prevent over-fetching)
    async getMistakes(userId: string, limit = 100): Promise<MistakeEntry[]> {
        if (!userId) return [];

        const { data, error } = await supabase
            .from('mistake_book')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error("Failed to fetch mistakes:", error);
            return [];
        }
        return data as MistakeEntry[];
    },

    async toggleMastered(mistakeId: string, isMastered: boolean) {
        // P1: Increment Review Count
        // First fetch current count (since we don't have a direct increment RPC)
        const { data: current } = await supabase
            .from('mistake_book')
            .select('review_count')
            .eq('id', mistakeId)
            .single();
        
        const nextCount = (current?.review_count || 0) + 1;

        const { error } = await supabase
            .from('mistake_book')
            .update({ 
                is_mastered: isMastered,
                review_count: nextCount
            })
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
