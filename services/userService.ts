
import { supabase } from './supabaseClient';
import { AssessmentData } from '../types';
import { achievementService } from './achievementService';

export interface Skills {
    Pronunciation: number;
    Structure: number;
    Vocabulary: number;
    Fluency: number;
    Comprehension: number;
    Interactions: number;
}

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
    skills: Skills;
}

export type SessionType = 'TRAINING' | 'ASSESSMENT';

export const userService = {
    // Get current authenticated user ID
    async getCurrentUserId(): Promise<string | null> {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user?.id || null;
    },

    // Fetch user profile stats
    async getProfile(): Promise<UserProfile | null> {
        const uid = await this.getCurrentUserId();
        if (!uid) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', uid)
            .single();

        if (error) {
             if (error.code !== 'PGRST116') { // PGRST116 is 'not found'
                 console.error('Error fetching profile:', error);
             }
             return null;
        }

        return data as UserProfile;
    },

    // Create a new profile (Used during registration)
    async createProfile(profileData: Partial<UserProfile>) {
        const uid = await this.getCurrentUserId();
        if (!uid) throw new Error("No authenticated user session found. Please login first.");

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

    // Fetch test reports (History)
    async getHistory() {
        const uid = await this.getCurrentUserId();
        if (!uid) return [];

        // Corrected table name to match SQL setup: 'training_logs'
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

    // Save a new test report and update stats
    async saveSession(
        scenarioTitle: string, 
        phase: string, 
        assessment: AssessmentData | null, 
        durationSeconds: number,
        sessionType: SessionType = 'TRAINING' // New parameter
    ) {
        const uid = await this.getCurrentUserId();
        if (!uid) return;

        const durationStr = `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;
        const score = assessment ? assessment.overallScore : 0;

        // 1. Insert Report into 'training_logs'
        const { error: logError } = await supabase
            .from('training_logs')
            .insert({
                user_id: uid,
                scenario_title: scenarioTitle,
                phase: phase,
                score: score,
                duration: durationStr,
                duration_seconds: durationSeconds,
                session_type: sessionType, // Store the type
                details: assessment
            });

        if (logError) console.error('Error saving report:', logError);

        // 2. Update Profile Stats
        const currentProfile = await this.getProfile();
        if (currentProfile) {
            const flightTimeHours = durationSeconds / 3600;
            
            // Update skills average if assessment exists
            let newSkills: Skills = currentProfile.skills;
            
            if (assessment) {
                // Simple weighted average (80% old, 20% new) to show progression but avoid volatility
                const updateSkill = (oldVal: any, newVal: number) => {
                    const numOld = typeof oldVal === 'number' ? oldVal : 3;
                    return parseFloat((numOld * 0.8 + newVal * 0.2).toFixed(1));
                };

                newSkills = {
                    Pronunciation: updateSkill(newSkills.Pronunciation, assessment.pronunciation),
                    Structure: updateSkill(newSkills.Structure, assessment.structure),
                    Vocabulary: updateSkill(newSkills.Vocabulary, assessment.vocabulary),
                    Fluency: updateSkill(newSkills.Fluency, assessment.fluency),
                    Comprehension: updateSkill(newSkills.Comprehension, assessment.comprehension),
                    Interactions: updateSkill(newSkills.Interactions, assessment.interactions),
                };
            }

            await supabase
                .from('profiles')
                .update({
                    flight_hours: Number(currentProfile.flight_hours || 0) + flightTimeHours,
                    total_sorties: (currentProfile.total_sorties || 0) + 1,
                    streak: (currentProfile.streak || 0) + 1, 
                    skills: newSkills
                })
                .eq('user_id', uid);

            // 3. Trigger Achievement Check
            await achievementService.checkAchievements(uid, sessionType, score);
        }
    }
};
