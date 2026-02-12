
import { supabase } from './supabaseClient';
import { AssessmentData } from '../types';

export interface Achievement {
    id: string;
    code: string;
    name: string;
    description: string;
    icon_url: string;
    unlocked_at?: string; // If populated, user has it
}

export const achievementService = {
    // Check and unlock achievements based on session data
    async checkAchievements(userId: string, sessionType: 'TRAINING' | 'ASSESSMENT', score: number) {
        if (!userId) return;

        // Fetch all system achievements first
        const { data: allAchievements } = await supabase.from('achievements').select('*');
        if (!allAchievements) return;

        // Fetch user's existing achievements to avoid duplicates
        const { data: userAchievements } = await supabase
            .from('user_achievements')
            .select('achievement_id')
            .eq('user_id', userId);
        
        const unlockedIds = new Set(userAchievements?.map(ua => ua.achievement_id));
        const newUnlocks: string[] = [];

        // --- RULES ENGINE ---
        
        // 1. FIRST_FLIGHT
        const firstFlight = allAchievements.find(a => a.code === 'FIRST_FLIGHT');
        if (firstFlight && !unlockedIds.has(firstFlight.id)) {
            newUnlocks.push(firstFlight.id);
        }

        // 2. LEVEL_4_PASSED (Score >= 4)
        if (score >= 4) {
            const lvl4 = allAchievements.find(a => a.code === 'LEVEL_4_PASSED');
            if (lvl4 && !unlockedIds.has(lvl4.id)) {
                newUnlocks.push(lvl4.id);
            }
        }

        // 3. LEVEL_5_MASTER (Score >= 5)
        if (score >= 5) {
            const lvl5 = allAchievements.find(a => a.code === 'LEVEL_5_MASTER');
            if (lvl5 && !unlockedIds.has(lvl5.id)) {
                newUnlocks.push(lvl5.id);
            }
        }

        // Batch Insert New Unlocks
        if (newUnlocks.length > 0) {
            const insertData = newUnlocks.map(aid => ({
                user_id: userId,
                achievement_id: aid
            }));
            await supabase.from('user_achievements').insert(insertData);
        }
        
        return newUnlocks.length > 0; // Return true if something new was unlocked
    },

    // Get all achievements with unlock status for the user
    async getUserAchievements(userId: string): Promise<Achievement[]> {
        if (!userId) return [];

        // 1. Get all definitions
        const { data: defs, error: err1 } = await supabase.from('achievements').select('*');
        if (err1 || !defs) return [];

        // 2. Get user unlocks
        const { data: unlocks, error: err2 } = await supabase
            .from('user_achievements')
            .select('achievement_id, unlocked_at')
            .eq('user_id', userId);
        
        if (err2) return [];

        // 3. Merge
        const unlockMap = new Map();
        unlocks?.forEach(u => unlockMap.set(u.achievement_id, u.unlocked_at));

        return defs.map((def: any) => ({
            ...def,
            unlocked_at: unlockMap.get(def.id) || null
        }));
    }
};
