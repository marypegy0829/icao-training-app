
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

// Interface for the new SQL View
interface CompetencyView {
    user_id: string;
    total_assessments: number;
    avg_pronunciation: number;
    avg_structure: number;
    avg_vocabulary: number;
    avg_fluency: number;
    avg_comprehension: number;
    avg_interactions: number;
    last_status: boolean;
    last_assessment_date: string;
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

        // 1. Fetch Basic Profile
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', uid)
            .single();

        if (profileError) {
             if (profileError.code !== 'PGRST116') { // PGRST116 is 'not found'
                 console.error('Error fetching profile:', profileError);
             }
             return null;
        }

        let finalProfile = profileData as UserProfile;

        // 2. Fetch Accurate Stats from SQL View (The Source of Truth for Assessments)
        try {
            const { data: statsData, error: statsError } = await supabase
                .from('pilot_competency_view')
                .select('*')
                .eq('user_id', uid)
                .maybeSingle(); // Use maybeSingle() as new users won't have a row in the view yet

            if (statsData) {
                const stats = statsData as CompetencyView;
                // Override the loosely kept JSON skills with the hard calculated SQL averages
                // Ensure we format to 1 decimal place to match UI expectations
                finalProfile.skills = {
                    Pronunciation: Number(stats.avg_pronunciation) || 3.0,
                    Structure: Number(stats.avg_structure) || 3.0,
                    Vocabulary: Number(stats.avg_vocabulary) || 3.0,
                    Fluency: Number(stats.avg_fluency) || 3.0,
                    Comprehension: Number(stats.avg_comprehension) || 3.0,
                    Interactions: Number(stats.avg_interactions) || 3.0
                };
            }
        } catch (e) {
            console.warn("Failed to sync with pilot_competency_view", e);
        }

        return finalProfile;
    },

    // Create a new profile (Used during registration)
    async createProfile(profileData: Partial<UserProfile>) {
        const uid = await this.getCurrentUserId();
        if (!uid) throw new Error("No authenticated user session found. Please login first.");

        // Define the profile object
        const newProfile = {
            user_id: uid,
            name: profileData.name || 'Pilot',
            airline: profileData.airline || '',
            aircraft_type: profileData.aircraft_type || '',
            flight_level: profileData.flight_level || 'Cadet',
            current_icao_level: profileData.current_icao_level || 4,
            // Default stats for new profile
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

        // FIX: Use upsert instead of insert.
        const { error } = await supabase
            .from('profiles')
            .upsert(newProfile, { onConflict: 'user_id' });

        if (error) throw error;
        return newProfile;
    },

    // Fetch test reports list (Optimized: No Details Blob)
    async getHistory() {
        const uid = await this.getCurrentUserId();
        if (!uid) return [];

        // Selecting only necessary columns for the list view to save bandwidth
        const { data, error } = await supabase
            .from('training_logs')
            .select('id, created_at, scenario_title, phase, score, duration, session_type')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(50); // Add limit for safety, pagination can be added later

        if (error) {
            console.error('Error fetching history:', error);
            return [];
        }
        return data;
    },

    // New method: Lazy load the full report details only when requested
    async getSessionDetails(sessionId: string): Promise<AssessmentData | null> {
        const { data, error } = await supabase
            .from('training_logs')
            .select('details, scenario_title') // FETCH scenario_title as well
            .eq('id', sessionId)
            .single();

        if (error || !data) {
            console.error("Failed to load session details", error);
            return null;
        }
        
        // Merge scenario title into the blob for easier access in UI
        const report = data.details as AssessmentData;
        if (report) {
            report.scenarioTitle = data.scenario_title;
        }
        return report;
    },

    // Save a new test report and update stats
    async saveSession(
        scenarioTitle: string, 
        phase: string, 
        assessment: AssessmentData | null, 
        durationSeconds: number,
        sessionType: SessionType = 'TRAINING' // New parameter
    ): Promise<{ success: boolean; error?: any }> {
        const uid = await this.getCurrentUserId();
        if (!uid) return { success: false, error: 'User not logged in' };

        // --- FIX: Zero Score Prevention ---
        // If assessment is null (e.g. aborted session), do not save to DB.
        if (!assessment) {
            console.log("Session aborted or no assessment generated. Skipping DB save to maintain data quality.");
            // We return success=true so the UI doesn't show an error, but we intentionally didn't save.
            return { success: true };
        }

        const durationStr = `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;
        const score = assessment.overallScore;

        // 1. Insert Report into 'training_logs' with structured scoring columns
        const { error: logError } = await supabase
            .from('training_logs')
            .insert({
                user_id: uid,
                scenario_title: scenarioTitle,
                phase: phase,
                score: score,
                duration: durationStr,
                duration_seconds: durationSeconds,
                session_type: sessionType,
                details: assessment, // Keep JSONB for UI rendering details
                // --- New Structured Fields for SQL Analytics ---
                score_pronunciation: assessment.pronunciation || null,
                score_structure: assessment.structure || null,
                score_vocabulary: assessment.vocabulary || null,
                score_fluency: assessment.fluency || null,
                score_comprehension: assessment.comprehension || null,
                score_interactions: assessment.interactions || null,
                is_operational: assessment.overallScore >= 4,
                fail_reason: assessment.executiveSummary?.frictionPoints || null
            });

        if (logError) {
            console.error('Error saving report:', logError);
            return { success: false, error: logError };
        }

        // 2. Update Profile Stats
        const currentProfile = await this.getProfile();
        if (currentProfile) {
            const flightTimeHours = durationSeconds / 3600;
            
            // Update skills average
            let newSkills: Skills = currentProfile.skills;
            
            // Simple weighted average logic retained for immediate UI updates
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

            await supabase
                .from('profiles')
                .update({
                    flight_hours: Number(currentProfile.flight_hours || 0) + flightTimeHours,
                    total_sorties: (currentProfile.total_sorties || 0) + 1,
                    streak: (currentProfile.streak || 0) + 1, 
                    skills: newSkills,
                    // If it's an assessment, update current level immediately if passed
                    ...(sessionType === 'ASSESSMENT' && assessment.overallScore >= 4 
                        ? { current_icao_level: assessment.overallScore } 
                        : {})
                })
                .eq('user_id', uid);

            // 3. Trigger Achievement Check
            await achievementService.checkAchievements(uid, sessionType, score);
        }
        
        return { success: true };
    }
};
