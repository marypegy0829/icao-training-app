
import { supabase } from './supabaseClient';
import { AssessmentData } from '../types';

export interface UserProfile {
    user_id: string;
    name: string;
    airline?: string;
    aircraft_type?: string;
    flight_level?: string; // e.g. Captain, FO
    current_icao_level?: number;
    flight_hours: number;
    total_sorties: number;
    streak: number;
    skills: any;
}

export const userService = {
    // Get current authenticated user ID
    async getCurrentUserId(): Promise<string | null> {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user?.id || null;
    },

    // Fetch user profile stats
    async getProfile() {
        const uid = await this.getCurrentUserId();
        if (!uid) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', uid)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is 'not found'
            console.error('Error fetching profile:', error);
            return null;
        }

        return data;
    },

    // Create a new profile (Used during registration)
    async createProfile(profileData: Partial<UserProfile>) {
        const uid = await this.getCurrentUserId();
        if (!uid) throw new Error("No authenticated user");

        const newProfile = {
            user_id: uid,
            name: profileData.name || 'Pilot',
            airline: profileData.airline || '',
            aircraft_type: profileData.aircraft_type || '',
            flight_level: profileData.flight_level || 'Cadet',
            current_icao_level: profileData.current_icao_level || 4,
            flight_hours: 0,
            total_sorties: 0,
            streak: 0,
            skills: {
                Pronunciation: 3.0,
                Structure: 3.0,
                Vocabulary: 3.0,
                Fluency: 3.0,
                Comprehension: 3.0,
                Interactions: 3.0
            }
        };

        const { error } = await supabase.from('profiles').insert(newProfile);
        if (error) throw error;
        return newProfile;
    },

    // Fetch training logs
    async getHistory() {
        const uid = await this.getCurrentUserId();
        if (!uid) return [];

        const { data, error } = await supabase
            .from('training_logs')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching history:', error);
            return [];
        }
        return data;
    },

    // Save a new training log and update stats
    async saveSession(
        scenarioTitle: string, 
        phase: string, 
        assessment: AssessmentData | null, 
        durationSeconds: number
    ) {
        const uid = await this.getCurrentUserId();
        if (!uid) return;

        const durationStr = `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;
        const score = assessment ? assessment.overallScore : 0;

        // 1. Insert Log
        const { error: logError } = await supabase
            .from('training_logs')
            .insert({
                user_id: uid,
                scenario_title: scenarioTitle,
                phase: phase,
                score: score,
                duration: durationStr,
                details: assessment
            });

        if (logError) console.error('Error saving log:', logError);

        // 2. Update Profile Stats
        const currentProfile = await this.getProfile();
        if (currentProfile) {
            const flightTimeHours = durationSeconds / 3600;
            
            // Update skills average if assessment exists
            let newSkills = currentProfile.skills;
            if (assessment) {
                // Simple weighted average (80% old, 20% new) to show progression
                const updateSkill = (oldVal: number, newVal: number) => parseFloat((oldVal * 0.8 + newVal * 0.2).toFixed(1));
                newSkills = {
                    Pronunciation: updateSkill(newSkills.Pronunciation || 3, assessment.pronunciation),
                    Structure: updateSkill(newSkills.Structure || 3, assessment.structure),
                    Vocabulary: updateSkill(newSkills.Vocabulary || 3, assessment.vocabulary),
                    Fluency: updateSkill(newSkills.Fluency || 3, assessment.fluency),
                    Comprehension: updateSkill(newSkills.Comprehension || 3, assessment.comprehension),
                    Interactions: updateSkill(newSkills.Interactions || 3, assessment.interactions),
                };
            }

            await supabase
                .from('profiles')
                .update({
                    flight_hours: Number(currentProfile.flight_hours) + flightTimeHours,
                    total_sorties: currentProfile.total_sorties + 1,
                    // Simple streak logic
                    streak: currentProfile.streak + 1, // Simplified increment
                    skills: newSkills
                })
                .eq('user_id', uid);
        }
    }
};
